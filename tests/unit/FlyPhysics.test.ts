import { describe, expect, it } from 'vitest';
import { FlyPhysics } from '../../src/fly/FlyPhysics';
import type { FlyState } from '../../src/fly/FlyTypes';
import type { BehaviorState } from '../../src/brain/BrainRuntimeTypes';

const baseState = (): FlyState => ({
  x: 0.5,
  y: 0.5,
  heading: 0,
  speed: 0,
  velocityX: 0,
  velocityY: 0,
});

const behavior = (overrides: Partial<BehaviorState> = {}): BehaviorState => ({
  turn: 0,
  forward: 0,
  dwell: 0,
  arousal: 0,
  ...overrides,
});

describe('FlyPhysics', () => {
  it('positive turn increases heading', () => {
    const next = FlyPhysics.step(baseState(), behavior({ turn: 1 }), 0.1);
    expect(next.heading).toBeGreaterThan(0);
  });

  it('forward 1 moves farther than forward 0', () => {
    const slow = FlyPhysics.step(baseState(), behavior({ forward: 0 }), 0.5);
    const fast = FlyPhysics.step(baseState(), behavior({ forward: 1 }), 0.5);
    expect(fast.x - 0.5).toBeGreaterThan(slow.x - 0.5);
  });

  it('dwell 1 reduces movement', () => {
    const moving = FlyPhysics.step(baseState(), behavior({ forward: 1, dwell: 0 }), 0.5);
    const dwelling = FlyPhysics.step(baseState(), behavior({ forward: 1, dwell: 1 }), 0.5);
    expect(dwelling.x - 0.5).toBeLessThan(moving.x - 0.5);
  });

  it('reflects at boundaries and stays inside normalized coordinates', () => {
    const state = baseState();
    state.x = 0.99;
    state.speed = 0.45;
    const next = FlyPhysics.step(state, behavior({ forward: 1 }), 1);

    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.x).toBeLessThanOrEqual(1);
    expect(Math.cos(next.heading)).toBeLessThan(0);
  });

  it('is deterministic from identical state and behavior', () => {
    const left = FlyPhysics.step(baseState(), behavior({ turn: -0.4, forward: 0.7, dwell: 0.2 }), 1 / 60);
    const right = FlyPhysics.step(baseState(), behavior({ turn: -0.4, forward: 0.7, dwell: 0.2 }), 1 / 60);
    expect(left).toEqual(right);
  });
});
