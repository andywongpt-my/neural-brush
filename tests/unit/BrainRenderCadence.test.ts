import { describe, expect, it } from 'vitest';
import { BrainRenderCadence } from '../../src/brain/BrainRenderCadence';

describe('BrainRenderCadence', () => {
  it('renders the first activation immediately and then caps redraws at the configured rate', () => {
    const cadence = new BrainRenderCadence(12);

    expect(cadence.shouldRender(0)).toBe(true);
    expect(cadence.shouldRender(40)).toBe(false);
    expect(cadence.shouldRender(82)).toBe(false);
    expect(cadence.shouldRender(84)).toBe(true);
    expect(cadence.shouldRender(120)).toBe(false);
    expect(cadence.shouldRender(168)).toBe(true);
  });

  it('resets so the next activation can render immediately', () => {
    const cadence = new BrainRenderCadence(12);
    expect(cadence.shouldRender(100)).toBe(true);
    expect(cadence.shouldRender(120)).toBe(false);

    cadence.reset();

    expect(cadence.shouldRender(121)).toBe(true);
  });

  it('rejects invalid frequency and timestamps', () => {
    expect(() => new BrainRenderCadence(0)).toThrow(RangeError);
    expect(() => new BrainRenderCadence(Number.NaN)).toThrow(RangeError);

    const cadence = new BrainRenderCadence(12);
    expect(() => cadence.shouldRender(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
