import { describe, expect, it } from 'vitest';
import type { BrainPresetV1 } from '../../src/preset/BrainPreset';
import {
  PRESET_FILE_MAX_BYTES,
  PRESET_FILE_MIME,
  PRESET_FILE_NAME,
  PresetFileError,
  createPresetFileBlob,
  readPresetFile,
} from '../../src/preset/PresetFileIO';

function preset(): BrainPresetV1 {
  return {
    schema: 1,
    dataset: 'male-cns:v1.0',
    circuit: 'dna-steering-v1',
    seed: 7,
    brush: 'glow',
    modulation: {
      '20': { inhibition: 0.25 },
      '3': { stimulation: 0.5 },
    },
    gains: {
      '20>3': 1.2,
    },
  };
}

describe('PresetFileIO', () => {
  it('creates the approved JSON preset file payload', async () => {
    const blob = createPresetFileBlob(preset());
    expect(PRESET_FILE_NAME).toBe('neural-brush-preset.neuralbrush.json');
    expect(PRESET_FILE_MIME).toBe('application/json');
    expect(blob.type).toBe(PRESET_FILE_MIME);
    expect(JSON.parse(await blob.text())).toEqual({
      schema: 1,
      dataset: 'male-cns:v1.0',
      circuit: 'dna-steering-v1',
      seed: 7,
      brush: 'glow',
      modulation: {
        '3': { stimulation: 0.5 },
        '20': { inhibition: 0.25 },
      },
      gains: {
        '20>3': 1.2,
      },
    });
  });

  it('reads JSON as unknown without silently validating it', async () => {
    const blob = new Blob(['{"hello":"world"}'], { type: 'application/json' });
    await expect(readPresetFile(blob)).resolves.toEqual({ hello: 'world' });
  });

  it('rejects malformed JSON', async () => {
    const blob = new Blob(['{bad json'], { type: 'application/json' });
    await expect(readPresetFile(blob)).rejects.toBeInstanceOf(PresetFileError);
  });

  it('rejects imports larger than 64 KiB before reading text', async () => {
    expect(PRESET_FILE_MAX_BYTES).toBe(64 * 1024);
    let textCalled = false;
    const oversized = {
      size: PRESET_FILE_MAX_BYTES + 1,
      text: async () => {
        textCalled = true;
        return '{}';
      },
    };

    await expect(readPresetFile(oversized)).rejects.toBeInstanceOf(PresetFileError);
    expect(textCalled).toBe(false);
  });
});
