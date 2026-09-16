import type {
  BrainPresetNeuronModulation,
  BrainPresetV1,
} from './BrainPreset';

export const PRESET_URL_MAX_JSON_BYTES = 16 * 1024;
export const PRESET_URL_MAX_ENCODED_CHARS = Math.ceil(
  (PRESET_URL_MAX_JSON_BYTES * 4) / 3,
);

export class PresetCodecError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PresetCodecError';
  }
}

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function compareBodyIds(left: string, right: string): number {
  const a = BigInt(left);
  const b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareEdgeKeys(left: string, right: string): number {
  const [leftSource, leftTarget] = left.split('>');
  const [rightSource, rightTarget] = right.split('>');
  if (!leftSource || !leftTarget || !rightSource || !rightTarget) {
    return left.localeCompare(right);
  }
  const sourceOrder = compareBodyIds(leftSource, rightSource);
  return sourceOrder !== 0 ? sourceOrder : compareBodyIds(leftTarget, rightTarget);
}

export function canonicalPresetObject(preset: BrainPresetV1): BrainPresetV1 {
  const modulation: Record<string, BrainPresetNeuronModulation> = {};
  for (const bodyId of Object.keys(preset.modulation).sort(compareBodyIds)) {
    const source = preset.modulation[bodyId];
    if (!source) continue;
    const entry: BrainPresetNeuronModulation = {};
    if (source.stimulation !== undefined) entry.stimulation = source.stimulation;
    if (source.inhibition !== undefined) entry.inhibition = source.inhibition;
    modulation[bodyId] = entry;
  }

  const gains: Record<string, number> = {};
  for (const key of Object.keys(preset.gains).sort(compareEdgeKeys)) {
    const value = preset.gains[key];
    if (value !== undefined) gains[key] = value;
  }

  return {
    schema: preset.schema,
    dataset: preset.dataset,
    circuit: preset.circuit,
    seed: preset.seed,
    brush: preset.brush,
    modulation,
    gains,
  };
}

export function canonicalPresetJson(preset: BrainPresetV1): string {
  return JSON.stringify(canonicalPresetObject(preset));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  if (encoded.length > PRESET_URL_MAX_ENCODED_CHARS) {
    throw new PresetCodecError('preset fragment exceeds the URL size limit');
  }
  if (!BASE64URL_PATTERN.test(encoded)) {
    throw new PresetCodecError('preset fragment is not valid base64url');
  }
  if (encoded.length % 4 === 1) {
    throw new PresetCodecError('preset fragment has an invalid base64url length');
  }

  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch (cause) {
    throw new PresetCodecError('preset fragment could not be decoded', { cause });
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export class PresetCodec {
  static encode(preset: BrainPresetV1): string {
    const bytes = new TextEncoder().encode(canonicalPresetJson(preset));
    if (bytes.byteLength > PRESET_URL_MAX_JSON_BYTES) {
      throw new PresetCodecError('preset is too large for URL sharing');
    }
    return bytesToBase64Url(bytes);
  }

  static decode(encoded: string): unknown {
    const bytes = base64UrlToBytes(encoded);
    if (bytes.byteLength > PRESET_URL_MAX_JSON_BYTES) {
      throw new PresetCodecError('decoded preset exceeds the URL size limit');
    }

    let json: string;
    try {
      json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (cause) {
      throw new PresetCodecError('preset fragment is not valid UTF-8', { cause });
    }

    try {
      return JSON.parse(json) as unknown;
    } catch (cause) {
      throw new PresetCodecError('preset fragment does not contain valid JSON', { cause });
    }
  }
}

export function writePresetFragment(encoded: string): void {
  if (!BASE64URL_PATTERN.test(encoded)) {
    throw new PresetCodecError('preset fragment is not valid base64url');
  }
  history.replaceState(
    null,
    '',
    `${location.pathname}${location.search}#preset=${encoded}`,
  );
}

export function readPresetFragment(hash = location.hash): string | null {
  if (!hash.startsWith('#') || hash.length <= 1) return null;
  const params = new URLSearchParams(hash.slice(1));
  const value = params.get('preset');
  return value && value.length > 0 ? value : null;
}
