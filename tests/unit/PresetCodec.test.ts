import { describe, expect, it, vi } from 'vitest';
import type { BrainPresetV1 } from '../../src/preset/BrainPreset';
import {
  PRESET_URL_MAX_ENCODED_CHARS,
  PresetCodec,
  PresetCodecError,
  readPresetFragment,
} from '../../src/preset/PresetCodec';

function presetWithOrder(reverse = false): BrainPresetV1 {
  const modulation: BrainPresetV1['modulation'] = {};
  const gains: BrainPresetV1['gains'] = {};

  const modulationEntries: Array<[string, BrainPresetV1['modulation'][string]]> = [
    ['10', { stimulation: 0.2 }],
    ['2', { inhibition: 0.4 }],
  ];
  const gainEntries: Array<[string, number]> = [
    ['10>2', 1.3],
    ['2>10', 0.7],
  ];

  for (const [key, value] of reverse ? modulationEntries.reverse() : modulationEntries) {
    modulation[key] = value;
  }
  for (const [key, value] of reverse ? gainEntries.reverse() : gainEntries) {
    gains[key] = value;
  }

  return {
    schema: 1,
    dataset: 'male-cns:v1.0',
    circuit: 'dna-steering-v1',
    seed: 42,
    brush: 'blend',
    modulation,
    gains,
  };
}

describe('PresetCodec', () => {
  it('encodes equivalent presets identically regardless of insertion order', () => {
    expect(PresetCodec.encode(presetWithOrder(false))).toBe(
      PresetCodec.encode(presetWithOrder(true)),
    );
  });

  it('round trips canonical preset JSON exactly', () => {
    const encoded = PresetCodec.encode(presetWithOrder(true));
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
    expect(PresetCodec.decode(encoded)).toEqual(presetWithOrder(false));
  });

  it('sorts modulation numerically and gains by numeric source then target', () => {
    const encoded = PresetCodec.encode(presetWithOrder(true));
    const decoded = PresetCodec.decode(encoded) as BrainPresetV1;
    expect(Object.keys(decoded.modulation)).toEqual(['2', '10']);
    expect(Object.keys(decoded.gains)).toEqual(['2>10', '10>2']);
  });

  it('rejects malformed base64url', () => {
    for (const value of ['', 'abc=', 'abc+', 'abc/', '#preset=abc', 'a b']) {
      expect(() => PresetCodec.decode(value)).toThrow(PresetCodecError);
    }
  });

  it('rejects URL payloads whose decoded JSON exceeds 16 KiB', () => {
    const oversized = presetWithOrder();
    oversized.modulation = {
      '2': { stimulation: 0.4 },
      '10': { inhibition: 0.2 },
      ['9'.repeat(17_000)]: { stimulation: 0.1 },
    };
    expect(() => PresetCodec.encode(oversized)).toThrow(PresetCodecError);
  });

  it('rejects oversized encoded fragments before base64 decoding', () => {
    const atobSpy = vi.spyOn(globalThis, 'atob');
    expect(() =>
      PresetCodec.decode('A'.repeat(PRESET_URL_MAX_ENCODED_CHARS + 1)),
    ).toThrow(PresetCodecError);
    expect(atobSpy).not.toHaveBeenCalled();
    atobSpy.mockRestore();
  });

  it('parses only an exact preset fragment key', () => {
    expect(readPresetFragment('#preset=abc_DEF-123')).toBe('abc_DEF-123');
    expect(readPresetFragment('#other=abc')).toBeNull();
    expect(readPresetFragment('#notpreset=abc')).toBeNull();
    expect(readPresetFragment('')).toBeNull();
  });
});
