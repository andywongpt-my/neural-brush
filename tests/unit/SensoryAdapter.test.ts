import { describe, expect, it } from 'vitest';
import { SensoryAdapter } from '../../src/vision/SensoryAdapter';
import type { SensorySample } from '../../src/vision/LocalVision';

const sample: SensorySample = {
  luminance: 0.1,
  saturation: 0.2,
  contrast: 0.3,
  edge: 0.4,
  motion: 0.5,
};

describe('SensoryAdapter', () => {
  it('maps features deterministically by input-port ordinal and leaves other nodes zero', () => {
    const ports = new Uint32Array([5, 1, 4, 2, 0, 3]);
    const first = SensoryAdapter.map(sample, ports, 7);
    const second = SensoryAdapter.map(sample, ports, 7);

    expect([...first]).toEqual([...second]);
    expect(first[5]).toBeCloseTo(0.1);
    expect(first[1]).toBeCloseTo(0.2);
    expect(first[4]).toBeCloseTo(0.3);
    expect(first[2]).toBeCloseTo(0.4);
    expect(first[0]).toBeCloseTo(0.5);
    expect(first[3]).toBeCloseTo(0.1);
    expect(first[6]).toBe(0);
  });

  it('rejects an input-port index outside the graph', () => {
    expect(() => SensoryAdapter.map(sample, new Uint32Array([2]), 2)).toThrow(RangeError);
  });
});
