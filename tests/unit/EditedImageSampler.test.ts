import { describe, expect, it } from 'vitest';
import {
  calculateReadbackRect,
  flipReadbackRows,
} from '../../src/vision/EditedImageSampler';

describe('calculateReadbackRect', () => {
  it('converts normalized center coordinates to WebGL bottom-left coordinates', () => {
    expect(calculateReadbackRect(100, 50, 0.5, 0.5, 4)).toEqual({
      x: 46,
      y: 20,
      width: 9,
      height: 9,
    });
  });

  it('maps top-left image coordinates to the top of the WebGL render target', () => {
    const topLeft = calculateReadbackRect(100, 50, 0, 0, 4);
    const bottomLeft = calculateReadbackRect(100, 50, 0, 1, 4);

    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(41);
    expect(bottomLeft.x).toBe(0);
    expect(bottomLeft.y).toBe(0);
  });

  it('clamps coordinates and caps readback to 32x32', () => {
    const rect = calculateReadbackRect(200, 120, 5, -3, 100);

    expect(rect.width).toBe(32);
    expect(rect.height).toBe(32);
    expect(rect.x).toBe(168);
    expect(rect.y).toBe(88);
  });

  it('never exceeds a target smaller than the requested patch', () => {
    expect(calculateReadbackRect(10, 6, 0.5, 0.5, 100)).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 6,
    });
  });
});

describe('flipReadbackRows', () => {
  it('converts bottom-up RGBA rows into top-left image order', () => {
    const bottomUp = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]);

    expect([...flipReadbackRows(bottomUp, 2, 2)]).toEqual([
      0, 0, 255, 255, 255, 255, 255, 255,
      255, 0, 0, 255, 0, 255, 0, 255,
    ]);
  });
});
