import type { BrainPresetV1 } from './BrainPreset';
import { canonicalPresetJson } from './PresetCodec';

export const PRESET_FILE_MAX_BYTES = 64 * 1024;
export const PRESET_FILE_MIME = 'application/json';
export const PRESET_FILE_NAME = 'neural-brush-preset.neuralbrush.json';

export class PresetFileError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PresetFileError';
  }
}

export interface PresetFileLike {
  readonly size: number;
  text(): Promise<string>;
}

export function createPresetFileBlob(preset: BrainPresetV1): Blob {
  return new Blob([canonicalPresetJson(preset)], {
    type: PRESET_FILE_MIME,
  });
}

export async function readPresetFile(file: PresetFileLike): Promise<unknown> {
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new PresetFileError('preset file size is invalid');
  }
  if (file.size > PRESET_FILE_MAX_BYTES) {
    throw new PresetFileError('preset file exceeds the 64 KiB import limit');
  }

  let text: string;
  try {
    text = await file.text();
  } catch (cause) {
    throw new PresetFileError('preset file could not be read', { cause });
  }

  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > PRESET_FILE_MAX_BYTES) {
    throw new PresetFileError('preset file exceeds the 64 KiB import limit');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new PresetFileError('preset file does not contain valid JSON', { cause });
  }
}
