import { describe, expect, it } from 'vitest';
import { CircuitGraph } from '../../src/brain/CircuitGraph';
import type { CircuitMetadata } from '../../src/brain/CircuitTypes';
import { ModulationLayer } from '../../src/brain/ModulationLayer';
import type { BrainPresetV1 } from '../../src/preset/BrainPreset';
import {
  PresetValidationError,
  applyPresetToModulation,
  presetFromState,
  validatePreset,
} from '../../src/preset/PresetValidation';

function graphFixture(): CircuitGraph {
  const metadata: CircuitMetadata = {
    schema: 1,
    dataset: 'male-cns:v1.0',
    circuit: 'dna-steering-v1',
    neurons: [
      {
        bodyId: '101',
        type: 'DNa01',
        instance: 'DNa01_L',
        somaSide: 'L',
        neurotransmitter: 'acetylcholine',
        inputPort: false,
        descendingSeed: true,
      },
      {
        bodyId: '202',
        type: 'DNa02',
        instance: 'DNa02_R',
        somaSide: 'R',
        neurotransmitter: 'acetylcholine',
        inputPort: false,
        descendingSeed: true,
      },
    ],
    behaviorPorts: {
      turnLeft: ['101'],
      turnRight: ['202'],
      forward: [],
    },
  };

  return new CircuitGraph(metadata, [
    { sourceIndex: 0, targetIndex: 1, weight: 12 },
  ]);
}

function validPreset(): BrainPresetV1 {
  return {
    schema: 1,
    dataset: 'male-cns:v1.0',
    circuit: 'dna-steering-v1',
    seed: 1234567890,
    brush: 'blend',
    modulation: {
      '101': { stimulation: 0.4 },
      '202': { inhibition: 0.3 },
    },
    gains: {
      '101>202': 1.25,
    },
  };
}

describe('validatePreset', () => {
  it('accepts a valid preset using known node and edge IDs', () => {
    const input = validPreset();
    const result = validatePreset(input, graphFixture());
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result.modulation).not.toBe(input.modulation);
  });

  it('rejects schema other than 1', () => {
    expect(() =>
      validatePreset({ ...validPreset(), schema: 2 }, graphFixture()),
    ).toThrow(PresetValidationError);
  });

  it('rejects another dataset or circuit', () => {
    expect(() =>
      validatePreset({ ...validPreset(), dataset: 'other' }, graphFixture()),
    ).toThrow(PresetValidationError);
    expect(() =>
      validatePreset({ ...validPreset(), circuit: 'other' }, graphFixture()),
    ).toThrow(PresetValidationError);
  });

  it('rejects unknown body IDs', () => {
    expect(() =>
      validatePreset(
        { ...validPreset(), modulation: { '999': { stimulation: 0.1 } } },
        graphFixture(),
      ),
    ).toThrow(PresetValidationError);
  });

  it('rejects unknown edge keys', () => {
    expect(() =>
      validatePreset(
        { ...validPreset(), gains: { '202>101': 1.1 } },
        graphFixture(),
      ),
    ).toThrow(PresetValidationError);
  });

  it('rejects non-finite stimulation inhibition and gain', () => {
    expect(() =>
      validatePreset(
        { ...validPreset(), modulation: { '101': { stimulation: Number.NaN } } },
        graphFixture(),
      ),
    ).toThrow(PresetValidationError);
    expect(() =>
      validatePreset(
        { ...validPreset(), modulation: { '101': { inhibition: Number.POSITIVE_INFINITY } } },
        graphFixture(),
      ),
    ).toThrow(PresetValidationError);
    expect(() =>
      validatePreset(
        { ...validPreset(), gains: { '101>202': Number.NEGATIVE_INFINITY } },
        graphFixture(),
      ),
    ).toThrow(PresetValidationError);
  });

  it('clamps legacy numeric overflow but keeps generated V1 state bounded', () => {
    const result = validatePreset(
      {
        ...validPreset(),
        modulation: {
          '101': { stimulation: 4, inhibition: -2 },
        },
        gains: { '101>202': 8 },
      },
      graphFixture(),
    );

    expect(result.modulation['101']).toEqual({ stimulation: 1, inhibition: 0 });
    expect(result.gains['101>202']).toBe(2);
  });

  it('rejects seeds outside uint32', () => {
    for (const seed of [-1, 2 ** 32, 1.5, Number.NaN]) {
      expect(() =>
        validatePreset({ ...validPreset(), seed }, graphFixture()),
      ).toThrow(PresetValidationError);
    }
  });

  it('rejects exotic or malformed object shapes', () => {
    expect(() => validatePreset([], graphFixture())).toThrow(PresetValidationError);
    expect(() =>
      validatePreset({ ...validPreset(), modulation: [] }, graphFixture()),
    ).toThrow(PresetValidationError);
    expect(() =>
      validatePreset({ ...validPreset(), gains: [] }, graphFixture()),
    ).toThrow(PresetValidationError);
    expect(() =>
      validatePreset(
        { ...validPreset(), modulation: { abc: { stimulation: 0.1 } } },
        graphFixture(),
      ),
    ).toThrow(PresetValidationError);
  });
});

describe('preset state conversion', () => {
  it('serializes only non-neutral modulation values and applies them back', () => {
    const graph = graphFixture();
    const modulation = new ModulationLayer(2, 1);
    modulation.setStimulation(0, 0.5);
    modulation.setInhibition(1, 0.25);
    modulation.setConnectionGain(0, 1.4);

    const preset = presetFromState(graph, modulation, 'glow', 42);
    expect(preset).toEqual({
      schema: 1,
      dataset: 'male-cns:v1.0',
      circuit: 'dna-steering-v1',
      seed: 42,
      brush: 'glow',
      modulation: {
        '101': { stimulation: 0.5 },
        '202': { inhibition: 0.25 },
      },
      gains: {
        '101>202': 1.4,
      },
    });

    const restored = new ModulationLayer(2, 1);
    applyPresetToModulation(preset, graph, restored);
    const snapshot = restored.snapshot();
    expect(Array.from(snapshot.stimulation)).toEqual([0.5, 0]);
    expect(Array.from(snapshot.inhibition)).toEqual([0, 0.25]);
    expect(Array.from(snapshot.connectionGain)).toEqual([1.4]);
  });
});
