import { describe, expect, it } from 'vitest';
import { FrameStats } from '../../src/perf/FrameStats';

describe('FrameStats', () => {
  it('reports average and p95 over recorded frame durations', () => {
    const stats = new FrameStats(120);
    for (const duration of [10, 12, 14, 16, 18, 20, 22, 24, 26, 40]) {
      stats.record(duration);
    }

    expect(stats.summary.count).toBe(10);
    expect(stats.summary.averageMs).toBeCloseTo(20.2);
    expect(stats.summary.p95Ms).toBe(40);
  });

  it('keeps only the newest values when its circular buffer is full', () => {
    const stats = new FrameStats(3);
    stats.record(10);
    stats.record(20);
    stats.record(30);
    stats.record(40);

    expect(stats.summary).toEqual({
      count: 3,
      averageMs: 30,
      p95Ms: 40,
    });
  });

  it('returns zeroed stats before any frames are recorded', () => {
    expect(new FrameStats().summary).toEqual({
      count: 0,
      averageMs: 0,
      p95Ms: 0,
    });
  });

  it('rejects invalid capacities and frame durations', () => {
    expect(() => new FrameStats(0)).toThrow(RangeError);
    expect(() => new FrameStats(1.5)).toThrow(RangeError);

    const stats = new FrameStats();
    expect(() => stats.record(-1)).toThrow(RangeError);
    expect(() => stats.record(Number.NaN)).toThrow(RangeError);
  });
});
