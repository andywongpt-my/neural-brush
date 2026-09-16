export interface FrameSummary {
  count: number;
  averageMs: number;
  p95Ms: number;
}

export class FrameStats {
  private readonly samples: Float64Array;
  private sampleCount = 0;
  private nextIndex = 0;

  constructor(capacity = 120) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.samples = new Float64Array(capacity);
  }

  record(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError('durationMs must be finite and non-negative');
    }

    this.samples[this.nextIndex] = durationMs;
    this.nextIndex = (this.nextIndex + 1) % this.samples.length;
    this.sampleCount = Math.min(this.sampleCount + 1, this.samples.length);
  }

  get summary(): FrameSummary {
    if (this.sampleCount === 0) {
      return { count: 0, averageMs: 0, p95Ms: 0 };
    }

    const values = Array.from(this.samples.subarray(0, this.sampleCount));
    let total = 0;
    for (const value of values) total += value;
    values.sort((a, b) => a - b);
    const p95Index = Math.min(
      values.length - 1,
      Math.max(0, Math.ceil(values.length * 0.95) - 1),
    );

    return {
      count: values.length,
      averageMs: total / values.length,
      p95Ms: values[p95Index],
    };
  }

  reset(): void {
    this.samples.fill(0);
    this.sampleCount = 0;
    this.nextIndex = 0;
  }
}
