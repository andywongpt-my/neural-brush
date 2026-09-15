export class SeededRandom {
  private readonly initialSeed: number;
  private state: number;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new RangeError('seed must be finite');
    }
    this.initialSeed = (seed >>> 0) || 0x6d2b79f5;
    this.state = this.initialSeed;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }

  reset(): void {
    this.state = this.initialSeed;
  }
}
