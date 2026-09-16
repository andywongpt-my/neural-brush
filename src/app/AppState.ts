import type { BehaviorState } from '../brain/BrainRuntimeTypes';
import type { FlyState } from '../fly/FlyTypes';

export type BrainStatus = 'idle' | 'loading' | 'ready' | 'paused' | 'error';

export interface AppSnapshot {
  readonly splitRatio: number;
  readonly imageName: string | null;
  readonly brainStatus: BrainStatus;
  readonly brainError: string | null;
  readonly behavior: Readonly<BehaviorState>;
  readonly fly: Readonly<FlyState>;
  readonly brainActivation: Float32Array | null;
  readonly brainActivationRevision: number;
}

type AppStateListener = (snapshot: AppSnapshot) => void;

const neutralBehavior = (): BehaviorState => ({
  turn: 0,
  forward: 0,
  dwell: 1,
  arousal: 0,
});

const initialFly = (): FlyState => ({
  x: 0.5,
  y: 0.5,
  heading: 0,
  speed: 0,
  velocityX: 0,
  velocityY: 0,
});

export class AppState {
  private splitRatio = 0.58;
  private imageName: string | null = null;
  private brainStatus: BrainStatus = 'idle';
  private brainError: string | null = null;
  private behavior: BehaviorState = neutralBehavior();
  private fly: FlyState = initialFly();
  private brainActivation: Float32Array | null = null;
  private brainActivationRevision = 0;
  private readonly listeners = new Set<AppStateListener>();

  setSplitRatio(value: number): void {
    this.splitRatio = Math.min(0.75, Math.max(0.35, value));
    this.emit();
  }

  setImageName(name: string | null): void {
    this.imageName = name;
    this.emit();
  }

  setBrainStatus(status: BrainStatus): void {
    this.brainStatus = status;
    this.emit();
  }

  setBrainError(message: string): void {
    this.brainError = message;
    this.brainStatus = 'error';
    this.emit();
  }

  clearBrainError(): void {
    this.brainError = null;
    this.emit();
  }

  setBehavior(value: BehaviorState): void {
    this.behavior = { ...value };
    this.emit();
  }

  setFly(value: FlyState): void {
    this.fly = { ...value };
    this.emit();
  }

  setBrainActivation(value: Float32Array | null): void {
    this.brainActivation = value?.slice() ?? null;
    this.brainActivationRevision += 1;
    this.emit();
  }

  resetRuntime(): void {
    this.brainError = null;
    this.behavior = neutralBehavior();
    this.fly = initialFly();
    this.brainActivation = null;
    this.brainActivationRevision += 1;
    this.emit();
  }

  subscribe(listener: AppStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AppSnapshot {
    return {
      splitRatio: this.splitRatio,
      imageName: this.imageName,
      brainStatus: this.brainStatus,
      brainError: this.brainError,
      behavior: { ...this.behavior },
      fly: { ...this.fly },
      brainActivation: this.brainActivation?.slice() ?? null,
      brainActivationRevision: this.brainActivationRevision,
    };
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
