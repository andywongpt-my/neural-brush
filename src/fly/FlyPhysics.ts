import type { BehaviorState } from '../brain/BrainRuntimeTypes';
import type { FlyState } from './FlyTypes';

const TURN_RATE = 2.4;
const MIN_SPEED = 0.02;
const MAX_SPEED = 0.45;

function validateState(state: FlyState): void {
  for (const [name, value] of Object.entries(state)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${name} must be finite`);
    }
  }
  if (state.x < 0 || state.x > 1 || state.y < 0 || state.y > 1) {
    throw new RangeError('fly position must remain within normalized coordinates');
  }
  if (state.speed < 0) {
    throw new RangeError('fly speed must be non-negative');
  }
}

function validateBehavior(behavior: BehaviorState): void {
  for (const [name, value] of Object.entries(behavior)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${name} must be finite`);
    }
  }
}

function reflectAxis(
  value: number,
  heading: number,
  horizontal: boolean,
): { value: number; heading: number } {
  let reflected = value;
  let nextHeading = heading;

  while (reflected < 0 || reflected > 1) {
    if (reflected < 0) {
      reflected = -reflected;
      nextHeading = horizontal ? Math.PI - nextHeading : -nextHeading;
    } else if (reflected > 1) {
      reflected = 2 - reflected;
      nextHeading = horizontal ? Math.PI - nextHeading : -nextHeading;
    }
  }

  return { value: reflected, heading: nextHeading };
}

export class FlyPhysics {
  static step(
    state: FlyState,
    behavior: BehaviorState,
    dtSeconds: number,
  ): FlyState {
    validateState(state);
    validateBehavior(behavior);
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new RangeError('dtSeconds must be a finite non-negative value');
    }

    let heading = state.heading + behavior.turn * TURN_RATE * dtSeconds;
    const targetSpeed =
      (MIN_SPEED + behavior.forward * (MAX_SPEED - MIN_SPEED)) *
      (1 - 0.8 * behavior.dwell);
    const speed = Math.max(
      0,
      state.speed +
        (targetSpeed - state.speed) * Math.min(1, dtSeconds * 8),
    );

    let x = state.x + Math.cos(heading) * speed * dtSeconds;
    let y = state.y + Math.sin(heading) * speed * dtSeconds;

    const reflectedX = reflectAxis(x, heading, true);
    x = reflectedX.value;
    heading = reflectedX.heading;

    const reflectedY = reflectAxis(y, heading, false);
    y = reflectedY.value;
    heading = reflectedY.heading;

    return {
      x,
      y,
      heading,
      speed,
      velocityX: Math.cos(heading) * speed,
      velocityY: Math.sin(heading) * speed,
    };
  }
}
