import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  validateImageDimensions,
} from '../../src/image/ImageLoader';

describe('validateImageDimensions', () => {
  it('accepts the maximum single-axis dimension', () => {
    expect(MAX_IMAGE_DIMENSION).toBe(8192);
    expect(() => validateImageDimensions(8192, 1)).not.toThrow();
  });

  it('rejects either axis above 8192', () => {
    expect(() => validateImageDimensions(8193, 1)).toThrow(RangeError);
    expect(() => validateImageDimensions(1, 8193)).toThrow(RangeError);
  });

  it('accepts exactly 40 million decoded pixels', () => {
    expect(MAX_IMAGE_PIXELS).toBe(40_000_000);
    expect(() => validateImageDimensions(8000, 5000)).not.toThrow();
  });

  it('rejects decoded images above 40 million pixels', () => {
    expect(() => validateImageDimensions(8001, 5000)).toThrow(RangeError);
  });

  it('rejects zero negative fractional and non-finite dimensions', () => {
    for (const [width, height] of [
      [0, 1],
      [1, 0],
      [-1, 1],
      [1.5, 1],
      [1, Number.NaN],
      [Number.POSITIVE_INFINITY, 1],
    ]) {
      expect(() => validateImageDimensions(width, height)).toThrow(RangeError);
    }
  });
});
