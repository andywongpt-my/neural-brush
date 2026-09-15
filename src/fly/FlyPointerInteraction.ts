export interface FlyPointerCallbacks {
  onDragStart(x: number, y: number): void;
  onDrag(x: number, y: number): void;
  onDragEnd(): void;
  onFollowTarget(x: number, y: number): void;
}

export type PointerDownResult = 'dragging' | 'followTarget';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function validateFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

export class FlyPointerInteraction {
  private dragging = false;

  constructor(
    private readonly callbacks: FlyPointerCallbacks,
    private readonly hitRadius = 0.06,
  ) {
    if (!Number.isFinite(hitRadius) || hitRadius <= 0 || hitRadius > 1) {
      throw new RangeError('hitRadius must be finite and within 0..1');
    }
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  pointerDown(
    x: number,
    y: number,
    flyX: number,
    flyY: number,
  ): PointerDownResult {
    validateFinite('x', x);
    validateFinite('y', y);
    validateFinite('flyX', flyX);
    validateFinite('flyY', flyY);

    const clampedX = clamp01(x);
    const clampedY = clamp01(y);
    const distance = Math.hypot(clampedX - flyX, clampedY - flyY);

    if (distance <= this.hitRadius) {
      this.dragging = true;
      this.callbacks.onDragStart(clampedX, clampedY);
      return 'dragging';
    }

    this.dragging = false;
    this.callbacks.onFollowTarget(clampedX, clampedY);
    return 'followTarget';
  }

  pointerMove(x: number, y: number): void {
    validateFinite('x', x);
    validateFinite('y', y);
    if (!this.dragging) return;
    this.callbacks.onDrag(clamp01(x), clamp01(y));
  }

  pointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.callbacks.onDragEnd();
  }
}
