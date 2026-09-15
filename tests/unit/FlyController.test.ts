import { describe, expect, it } from 'vitest';
import { FlyController } from '../../src/fly/FlyController';
import type { BehaviorState } from '../../src/brain/BrainRuntimeTypes';

const neural: BehaviorState = {
  turn: 0,
  forward: 0.8,
  dwell: 0,
  arousal: 0.5,
};

describe('FlyController', () => {
  it('uses autonomous neural motion by default', () => {
    const controller = new FlyController();
    const before = controller.state;
    const after = controller.step(neural, 0.25);

    expect(controller.mode).toBe('autonomous');
    expect(after.x).toBeGreaterThan(before.x);
  });

  it('follow target overrides turn direction but preserves neural drive values', () => {
    const controller = new FlyController();
    controller.setFollowTarget(0.5, 0.9);
    const after = controller.step(neural, 0.1);

    expect(controller.mode).toBe('followTarget');
    expect(after.heading).toBeGreaterThan(0);
  });

  it('dragging has priority over follow target and directly controls position', () => {
    const controller = new FlyController();
    controller.setFollowTarget(1, 1);
    controller.beginDrag(0.2, 0.3);
    const dragged = controller.dragTo(0.8, 0.7, 0.2);

    expect(controller.mode).toBe('dragging');
    expect(dragged.x).toBeCloseTo(0.8);
    expect(dragged.y).toBeCloseTo(0.7);
    expect(dragged.velocityX).toBeCloseTo(3);
    expect(dragged.velocityY).toBeCloseTo(2);
  });

  it('returns to follow target after drag release when a target is still active', () => {
    const controller = new FlyController();
    controller.setFollowTarget(1, 1);
    controller.beginDrag(0.4, 0.4);
    controller.endDrag();
    expect(controller.mode).toBe('followTarget');
  });

  it('returns to autonomous after drag release when no follow target is active', () => {
    const controller = new FlyController();
    controller.beginDrag(0.4, 0.4);
    controller.endDrag();
    expect(controller.mode).toBe('autonomous');
  });

  it('clamps direct drag positions to the normalized image', () => {
    const controller = new FlyController();
    controller.beginDrag(0.5, 0.5);
    const state = controller.dragTo(2, -1, 0.1);
    expect(state.x).toBe(1);
    expect(state.y).toBe(0);
  });
});
