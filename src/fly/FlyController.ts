import type { BehaviorState } from '../brain/BrainRuntimeTypes';
import { FlyPhysics } from './FlyPhysics';
import type { FlyControlMode, FlyState, FlyTarget } from './FlyTypes';

const TURN_RATE = 2.4;
const MAX_AUTONOMOUS_SPEED = 0.45;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function normalizeAngle(value: number): number {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function makeDefaultState(): FlyState {
  return {
    x: 0.5,
    y: 0.5,
    heading: 0,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
  };
}

function cloneState(state: FlyState): FlyState {
  return { ...state };
}

function validatePosition(x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('fly coordinates must be finite');
  }
}

export class FlyController {
  private currentState: FlyState;
  private target: FlyTarget | null = null;
  private dragging = false;

  constructor(initialState: FlyState = makeDefaultState()) {
    validatePosition(initialState.x, initialState.y);
    if (
      initialState.x < 0 ||
      initialState.x > 1 ||
      initialState.y < 0 ||
      initialState.y > 1
    ) {
      throw new RangeError('initial fly position must be normalized');
    }
    for (const value of [
      initialState.heading,
      initialState.speed,
      initialState.velocityX,
      initialState.velocityY,
    ]) {
      if (!Number.isFinite(value)) {
        throw new RangeError('initial fly state must be finite');
      }
    }
    if (initialState.speed < 0) {
      throw new RangeError('initial fly speed must be non-negative');
    }
    this.currentState = cloneState(initialState);
  }

  get state(): FlyState {
    return cloneState(this.currentState);
  }

  get mode(): FlyControlMode {
    if (this.dragging) return 'dragging';
    if (this.target) return 'followTarget';
    return 'autonomous';
  }

  setFollowTarget(x: number, y: number): void {
    validatePosition(x, y);
    this.target = { x: clamp01(x), y: clamp01(y) };
  }

  clearFollowTarget(): void {
    this.target = null;
  }

  beginDrag(x: number, y: number): FlyState {
    validatePosition(x, y);
    this.dragging = true;
    this.currentState = {
      ...this.currentState,
      x: clamp01(x),
      y: clamp01(y),
      speed: 0,
      velocityX: 0,
      velocityY: 0,
    };
    return this.state;
  }

  dragTo(x: number, y: number, dtSeconds: number): FlyState {
    if (!this.dragging) {
      throw new Error('dragTo requires an active drag');
    }
    validatePosition(x, y);
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      throw new RangeError('drag dtSeconds must be a positive finite value');
    }

    const nextX = clamp01(x);
    const nextY = clamp01(y);
    const velocityX = (nextX - this.currentState.x) / dtSeconds;
    const velocityY = (nextY - this.currentState.y) / dtSeconds;
    const pointerSpeed = Math.hypot(velocityX, velocityY);
    const heading =
      pointerSpeed > 0
        ? Math.atan2(velocityY, velocityX)
        : this.currentState.heading;

    this.currentState = {
      x: nextX,
      y: nextY,
      heading,
      speed: Math.min(pointerSpeed, MAX_AUTONOMOUS_SPEED),
      velocityX,
      velocityY,
    };
    return this.state;
  }

  endDrag(): void {
    this.dragging = false;
  }

  step(behavior: BehaviorState, dtSeconds: number): FlyState {
    if (this.dragging) return this.state;

    let effectiveBehavior = behavior;
    if (this.target) {
      const desiredHeading = Math.atan2(
        this.target.y - this.currentState.y,
        this.target.x - this.currentState.x,
      );
      const difference = normalizeAngle(desiredHeading - this.currentState.heading);
      const denominator = TURN_RATE * Math.max(dtSeconds, Number.EPSILON);
      effectiveBehavior = {
        ...behavior,
        turn: clamp(difference / denominator, -1, 1),
      };
    }

    this.currentState = FlyPhysics.step(
      this.currentState,
      effectiveBehavior,
      dtSeconds,
    );
    return this.state;
  }
}
