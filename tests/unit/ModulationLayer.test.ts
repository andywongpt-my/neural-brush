import { describe, expect, it } from 'vitest';
import { ModulationLayer } from '../../src/brain/ModulationLayer';

describe('ModulationLayer', () => {
  it('clamps neuron modulation to 0..1 and edge gain to 0..2', () => {
    const modulation = new ModulationLayer(2, 1);

    modulation.setStimulation(0, 2);
    modulation.setInhibition(1, -1);
    modulation.setConnectionGain(0, 5);

    expect(modulation.stimulation[0]).toBe(1);
    expect(modulation.inhibition[1]).toBe(0);
    expect(modulation.connectionGain[0]).toBe(2);
  });

  it('resets to neutral state', () => {
    const modulation = new ModulationLayer(1, 1);
    modulation.setStimulation(0, 0.5);
    modulation.setInhibition(0, 0.3);
    modulation.setConnectionGain(0, 0.2);

    modulation.reset();

    expect([...modulation.stimulation]).toEqual([0]);
    expect([...modulation.inhibition]).toEqual([0]);
    expect([...modulation.connectionGain]).toEqual([1]);
  });

  it('rejects invalid neuron and edge indices', () => {
    const modulation = new ModulationLayer(1, 1);

    expect(() => modulation.setStimulation(1, 0.5)).toThrow(RangeError);
    expect(() => modulation.setInhibition(-1, 0.5)).toThrow(RangeError);
    expect(() => modulation.setConnectionGain(1, 1)).toThrow(RangeError);
  });

  it('returns defensive copies of mutable state', () => {
    const modulation = new ModulationLayer(1, 1);
    modulation.setStimulation(0, 0.4);

    const copy = modulation.stimulation;
    copy[0] = 1;

    expect(modulation.stimulation[0]).toBeCloseTo(0.4);
  });
});
