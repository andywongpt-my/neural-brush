import type { BrushMode } from '../brush/BrushTypes';

export interface BrainPresetNeuronModulation {
  stimulation?: number;
  inhibition?: number;
}

export interface BrainPresetV1 {
  schema: 1;
  dataset: 'male-cns:v1.0';
  circuit: 'dna-steering-v1';
  seed: number;
  brush: BrushMode;
  modulation: Record<string, BrainPresetNeuronModulation>;
  gains: Record<string, number>;
}

export const PRESET_SCHEMA_VERSION = 1 as const;
export const PRESET_DATASET = 'male-cns:v1.0' as const;
export const PRESET_CIRCUIT = 'dna-steering-v1' as const;
export const UINT32_MAX = 0xffffffff;

export const BRUSH_MODES: readonly BrushMode[] = [
  'smear',
  'saturation',
  'glow',
  'blend',
] as const;
