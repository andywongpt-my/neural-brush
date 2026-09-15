import { describe, expect, it } from 'vitest';
import { mapFlyToBrush } from '../../src/brush/BrushBehaviorMap';
import type { BehaviorState } from '../../src/brain/BrainRuntimeTypes';
import type { FlyState } from '../../src/fly/FlyTypes';

const behavior = (overrides: Partial<BehaviorState> = {}): BehaviorState => ({
  turn: 0,
  forward: 0,
  dwell: 0.2,
  arousal: 0.3,
  ...overrides,
});

const fly = (overrides: Partial<FlyState> = {}): FlyState => ({
  x: 0.5,
  y: 0.5,
  heading: 0,
  speed: 0.1,
  velocityX: 0.1,
  velocityY: 0,
  ...overrides,
});

describe('mapFlyToBrush', () => {
  it('increases smear when fly speed increases', () => {
    const slow = mapFlyToBrush(fly({ speed: 0.05, velocityX: 0.05 }), behavior(), 'smear');
    const fast = mapFlyToBrush(fly({ speed: 0.45, velocityX: 0.45 }), behavior(), 'smear');

    expect(fast.smear).toBeGreaterThan(slow.smear);
  });

  it('increases saturation when dwell increases', () => {
    const low = mapFlyToBrush(fly(), behavior({ dwell: 0.1 }), 'saturation');
    const high = mapFlyToBrush(fly(), behavior({ dwell: 0.9 }), 'saturation');

    expect(high.saturation).toBeGreaterThan(low.saturation);
  });

  it('increases glow when arousal increases', () => {
    const low = mapFlyToBrush(fly(), behavior({ arousal: 0.1 }), 'glow');
    const high = mapFlyToBrush(fly(), behavior({ arousal: 0.9 }), 'glow');

    expect(high.glow).toBeGreaterThan(low.glow);
  });

  it('sets non-selected effects to zero outside blend mode', () => {
    const frame = mapFlyToBrush(fly({ speed: 0.3 }), behavior({ dwell: 0.8, arousal: 0.8 }), 'smear');

    expect(frame.smear).toBeGreaterThan(0);
    expect(frame.saturation).toBe(0);
    expect(frame.glow).toBe(0);
  });

  it('keeps center, radius, velocity and strengths bounded', () => {
    const frame = mapFlyToBrush(
      fly({ x: 2, y: -1, speed: 5, velocityX: 5, velocityY: 5 }),
      behavior({ dwell: 4, arousal: 4 }),
      'blend',
    );

    expect(frame.centerX).toBe(1);
    expect(frame.centerY).toBe(0);
    expect(frame.radius).toBeGreaterThan(0);
    expect(frame.radius).toBeLessThanOrEqual(0.07);
    expect(Math.hypot(frame.velocityX, frame.velocityY)).toBeLessThanOrEqual(1.000001);
    expect(frame.smear).toBeGreaterThanOrEqual(0);
    expect(frame.smear).toBeLessThanOrEqual(1);
    expect(frame.saturation).toBeLessThanOrEqual(1);
    expect(frame.glow).toBeLessThanOrEqual(1);
  });
});
