import { describe, expect, it } from 'vitest';
import { LocalVision } from '../../src/vision/LocalVision';

function rgba(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data.set(pixel(x, y), offset);
    }
  }
  return data;
}

describe('LocalVision', () => {
  it('returns zero luminance, contrast, and edge for a uniform black patch', () => {
    const pixels = rgba(3, 3, () => [0, 0, 0, 255]);
    const sample = LocalVision.sample(pixels, 3, 3, 0.5, 0.5, 1);

    expect(sample.luminance).toBe(0);
    expect(sample.contrast).toBe(0);
    expect(sample.edge).toBe(0);
  });

  it('returns luminance near one for a uniform white patch', () => {
    const pixels = rgba(3, 3, () => [255, 255, 255, 255]);
    const sample = LocalVision.sample(pixels, 3, 3, 0.5, 0.5, 1);

    expect(sample.luminance).toBeCloseTo(1, 6);
  });

  it('detects more contrast and edge in a red/green checkerboard than a uniform patch', () => {
    const checker = rgba(4, 4, (x, y) =>
      (x + y) % 2 === 0 ? [255, 0, 0, 255] : [0, 255, 0, 255],
    );
    const uniform = rgba(4, 4, () => [127, 127, 127, 255]);

    const checkerSample = LocalVision.sample(checker, 4, 4, 0.5, 0.5, 2);
    const uniformSample = LocalVision.sample(uniform, 4, 4, 0.5, 0.5, 2);

    expect(checkerSample.contrast).toBeGreaterThan(uniformSample.contrast);
    expect(checkerSample.edge).toBeGreaterThan(uniformSample.edge);
  });

  it('reports zero motion for identical current and previous pixels', () => {
    const pixels = rgba(3, 3, (x, y) => [x * 30, y * 40, 20, 255]);
    const sample = LocalVision.sample(pixels, 3, 3, 0.5, 0.5, 1, pixels.slice());

    expect(sample.motion).toBe(0);
  });

  it('keeps every feature bounded to 0..1 at image edges', () => {
    const pixels = rgba(2, 2, (x, y) => [x * 255, y * 255, 255, 255]);
    const sample = LocalVision.sample(pixels, 2, 2, 0, 0, 3);

    for (const value of Object.values(sample)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
