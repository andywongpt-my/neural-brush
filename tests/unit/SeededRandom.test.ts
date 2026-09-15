import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../src/brain/SeededRandom';

describe('SeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);

    expect([a.next(), a.next(), a.next()]).toEqual([
      b.next(),
      b.next(),
      b.next(),
    ]);
  });

  it('returns values in the half-open interval [0, 1)', () => {
    const random = new SeededRandom(1);

    for (let index = 0; index < 1000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('uses the documented non-zero fallback for seed 0', () => {
    const a = new SeededRandom(0);
    const b = new SeededRandom(0x6d2b79f5);

    expect([a.next(), a.next(), a.next()]).toEqual([
      b.next(),
      b.next(),
      b.next(),
    ]);
  });
});
