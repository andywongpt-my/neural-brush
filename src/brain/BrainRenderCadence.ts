export class BrainRenderCadence {
  private readonly intervalMs: number;
  private lastRenderMs: number | null = null;

  constructor(frequencyHz: number) {
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
      throw new RangeError('frequencyHz must be finite and positive');
    }
    this.intervalMs = 1000 / frequencyHz;
  }

  shouldRender(timeMs: number): boolean {
    if (!Number.isFinite(timeMs)) {
      throw new RangeError('timeMs must be finite');
    }

    if (
      this.lastRenderMs === null ||
      timeMs - this.lastRenderMs >= this.intervalMs
    ) {
      this.lastRenderMs = timeMs;
      return true;
    }

    return false;
  }

  reset(): void {
    this.lastRenderMs = null;
  }
}
