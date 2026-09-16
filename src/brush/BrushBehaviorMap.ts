import type { BehaviorState } from '../brain/BrainRuntimeTypes';
import type { FlyState } from '../fly/FlyTypes';
import type { BrushFrame, BrushMode } from './BrushTypes';

const MAX_FLY_SPEED = 0.45;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function boundedVelocity(x: number, y: number): { x: number; y: number } {
  let vx = finiteOrZero(x) / MAX_FLY_SPEED;
  let vy = finiteOrZero(y) / MAX_FLY_SPEED;
  const magnitude = Math.hypot(vx, vy);
  if (magnitude > 1 && magnitude > 0) {
    vx /= magnitude;
    vy /= magnitude;
  }
  return { x: vx, y: vy };
}

export function mapFlyToBrush(
  fly: FlyState,
  behavior: BehaviorState,
  mode: BrushMode,
): BrushFrame {
  const speed01 = clamp01(finiteOrZero(fly.speed) / MAX_FLY_SPEED);
  const dwell = clamp01(finiteOrZero(behavior.dwell));
  const arousal = clamp01(finiteOrZero(behavior.arousal));

  const rawSmear = clamp01(0.15 + speed01 * 0.85);
  const rawSaturation = clamp01(dwell * (0.35 + 0.65 * arousal));
  const rawGlow = clamp01(arousal * (0.35 + 0.65 * speed01));
  const radius = 0.025 + 0.045 * (0.5 * arousal + 0.5 * dwell);
  const velocity = boundedVelocity(fly.velocityX, fly.velocityY);

  return {
    centerX: clamp01(finiteOrZero(fly.x)),
    centerY: clamp01(finiteOrZero(fly.y)),
    velocityX: velocity.x,
    velocityY: velocity.y,
    radius,
    smear: mode === 'smear' || mode === 'blend' ? rawSmear : 0,
    saturation:
      mode === 'saturation' || mode === 'blend' ? rawSaturation : 0,
    glow: mode === 'glow' || mode === 'blend' ? rawGlow : 0,
  };
}
