import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  calculateReadbackRect,
  flipReadbackRows,
  readEditedPatch,
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

describe('readEditedPatch', () => {
  it('reads the edited target rectangle and returns top-left RGBA order', () => {
    const calls: number[][] = [];
    const reader = {
      readRenderTargetPixels(
        _target: THREE.WebGLRenderTarget,
        x: number,
        y: number,
        width: number,
        height: number,
        buffer: Uint8Array,
      ) {
        calls.push([x, y, width, height]);
        for (let row = 0; row < height; row += 1) {
          for (let col = 0; col < width; col += 1) {
            const offset = (row * width + col) * 4;
            buffer[offset] = row * 50;
            buffer[offset + 1] = col * 50;
            buffer[offset + 2] = 0;
            buffer[offset + 3] = 255;
          }
        }
      },
    };
    const target = new THREE.WebGLRenderTarget(4, 4);

    const patch = readEditedPatch(reader, target, 4, 4, 0, 0, 1);

    expect(calls).toEqual([[0, 1, 3, 3]]);
    expect(patch.width).toBe(3);
    expect(patch.height).toBe(3);
    expect([...patch.data.slice(0, 4)]).toEqual([100, 0, 0, 255]);
    expect([...patch.data.slice(-4)]).toEqual([0, 100, 0, 255]);
    target.dispose();
  });
});
