import { describe, expect, it, vi } from 'vitest';
import { AppState } from '../../src/app/AppState';
import type { BehaviorState } from '../../src/brain/BrainRuntimeTypes';
import type { FlyState } from '../../src/fly/FlyTypes';

describe('AppState', () => {
  it('starts at the approved layout with neutral runtime state', () => {
    const snapshot = new AppState().getSnapshot();
    expect(snapshot.splitRatio).toBe(0.58);
    expect(snapshot.imageName).toBeNull();
    expect(snapshot.brainStatus).toBe('idle');
    expect(snapshot.brainError).toBeNull();
    expect(snapshot.brainActivationRevision).toBe(0);
    expect(snapshot.brainPresentationRevision).toBe(0);
    expect(snapshot.behavior).toEqual({
      turn: 0,
      forward: 0,
      dwell: 1,
      arousal: 0,
    });
    expect(snapshot.fly.x).toBe(0.5);
    expect(snapshot.fly.y).toBe(0.5);
  });

  it('clamps the draggable divider to safe bounds', () => {
    const state = new AppState();
    state.setSplitRatio(0.1);
    expect(state.getSnapshot().splitRatio).toBe(0.35);
    state.setSplitRatio(0.95);
    expect(state.getSnapshot().splitRatio).toBe(0.75);
  });

  it('publishes runtime changes to subscribers', () => {
    const state = new AppState();
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.setBrainStatus('loading');
    state.setBrainStatus('ready');
    unsubscribe();
    state.setBrainStatus('paused');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].brainStatus).toBe('ready');
  });

  it('returns defensive copies of behavior, fly, and activation state', () => {
    const state = new AppState();
    const behavior: BehaviorState = {
      turn: 0.5,
      forward: 0.6,
      dwell: 0.4,
      arousal: 0.7,
    };
    const fly: FlyState = {
      x: 0.2,
      y: 0.3,
      heading: 1,
      speed: 0.1,
      velocityX: 0.05,
      velocityY: 0.08,
    };
    state.setBehavior(behavior);
    state.setFly(fly);
    state.setBrainActivation(new Float32Array([0.1, 0.2]));

    const snapshot = state.getSnapshot();
    (snapshot.behavior as BehaviorState).turn = -1;
    (snapshot.fly as FlyState).x = 1;
    snapshot.brainActivation![0] = 1;

    const next = state.getSnapshot();
    expect(next.behavior.turn).toBe(0.5);
    expect(next.fly.x).toBe(0.2);
    expect(next.brainActivation?.[0]).toBeCloseTo(0.1);
  });

  it('increments activation revision only for neural activation changes', () => {
    const state = new AppState();
    expect(state.getSnapshot().brainActivationRevision).toBe(0);

    state.setFly({
      x: 0.4,
      y: 0.5,
      heading: 0,
      speed: 0.1,
      velocityX: 0.1,
      velocityY: 0,
    });
    state.setBehavior({ turn: 0.2, forward: 0, dwell: 1, arousal: 0.3 });
    expect(state.getSnapshot().brainActivationRevision).toBe(0);

    state.setBrainActivation(new Float32Array([0.1, 0.2]));
    expect(state.getSnapshot().brainActivationRevision).toBe(1);
    state.setBrainActivation(new Float32Array([0.3, 0.4]));
    expect(state.getSnapshot().brainActivationRevision).toBe(2);

    state.resetRuntime();
    expect(state.getSnapshot().brainActivationRevision).toBe(3);
  });

  it('increments brain presentation revision only for brain UI changes', () => {
    const state = new AppState();
    expect(state.getSnapshot().brainPresentationRevision).toBe(0);

    state.setFly({
      x: 0.4,
      y: 0.5,
      heading: 0,
      speed: 0.1,
      velocityX: 0.1,
      velocityY: 0,
    });
    state.setImageName('local.png');
    state.setSplitRatio(0.6);
    state.setBrainActivation(new Float32Array([0.1]));
    expect(state.getSnapshot().brainPresentationRevision).toBe(0);

    state.setBrainStatus('loading');
    expect(state.getSnapshot().brainPresentationRevision).toBe(1);
    state.setBehavior({ turn: 0.2, forward: 0, dwell: 1, arousal: 0.3 });
    expect(state.getSnapshot().brainPresentationRevision).toBe(2);
    state.setBrainError('worker failed');
    expect(state.getSnapshot().brainPresentationRevision).toBe(3);
    state.clearBrainError();
    expect(state.getSnapshot().brainPresentationRevision).toBe(4);
    state.resetRuntime();
    expect(state.getSnapshot().brainPresentationRevision).toBe(5);
  });

  it('stores and clears worker errors explicitly', () => {
    const state = new AppState();
    state.setBrainError('worker failed');
    expect(state.getSnapshot().brainStatus).toBe('error');
    expect(state.getSnapshot().brainError).toBe('worker failed');
    state.clearBrainError();
    expect(state.getSnapshot().brainError).toBeNull();
  });
});
