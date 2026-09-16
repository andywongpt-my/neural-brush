export class SensoryCadence {
  private readonly intervalMs: number;
  private lastSampleMs: number | null = null;

  constructor(frequencyHz: number) {
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
      throw new RangeError('frequencyHz must be finite and positive');
    }
    this.intervalMs = 1000 / frequencyHz;
  }

  shouldSample(timeMs: number): boolean {
    if (!Number.isFinite(timeMs)) {
      throw new RangeError('timeMs must be finite');
    }

    if (
      this.lastSampleMs === null ||
      timeMs - this.lastSampleMs >= this.intervalMs
    ) {
      this.lastSampleMs = timeMs;
      return true;
    }

    return false;
  }

  reset(): void {
    this.lastSampleMs = null;
  }
}
