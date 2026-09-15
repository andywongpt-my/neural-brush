import { describe, expect, it } from 'vitest';
import { SensoryCadence } from '../../src/vision/SensoryCadence';

describe('SensoryCadence', () => {
  it('allows the first sample immediately and then caps sampling at 30hz', () => {
    const cadence = new SensoryCadence(30);

    expect(cadence.shouldSample(0)).toBe(true);
    expect(cadence.shouldSample(10)).toBe(false);
    expect(cadence.shouldSample(33)).toBe(false);
    expect(cadence.shouldSample(34)).toBe(true);
    expect(cadence.shouldSample(60)).toBe(false);
    expect(cadence.shouldSample(68)).toBe(true);
  });

  it('becomes immediately eligible after reset', () => {
    const cadence = new SensoryCadence(30);
    expect(cadence.shouldSample(100)).toBe(true);
    expect(cadence.shouldSample(110)).toBe(false);
    cadence.reset();
    expect(cadence.shouldSample(110)).toBe(true);
  });

  it('rejects invalid frequencies and timestamps', () => {
    expect(() => new SensoryCadence(0)).toThrow(RangeError);
    const cadence = new SensoryCadence(30);
    expect(() => cadence.shouldSample(Number.NaN)).toThrow(RangeError);
  });
});
