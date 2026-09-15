export interface SensorySample {
  luminance: number;
  saturation: number;
  contrast: number;
  edge: number;
  motion: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function validateImage(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  previous?: Uint8ClampedArray,
): void {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError('width and height must be positive integers');
  }
  const expectedLength = width * height * 4;
  if (pixels.length !== expectedLength) {
    throw new RangeError(`pixel buffer length ${pixels.length} does not match ${expectedLength}`);
  }
  if (previous && previous.length !== expectedLength) {
    throw new RangeError('previous pixel buffer must match current dimensions');
  }
}

function luminanceAt(pixels: Uint8ClampedArray, offset: number): number {
  return (
    0.2126 * pixels[offset] +
    0.7152 * pixels[offset + 1] +
    0.0722 * pixels[offset + 2]
  ) / 255;
}

function saturationAt(pixels: Uint8ClampedArray, offset: number): number {
  const red = pixels[offset] / 255;
  const green = pixels[offset + 1] / 255;
  const blue = pixels[offset + 2] / 255;
  const max = Math.max(red, green, blue);
  if (max === 0) return 0;
  const min = Math.min(red, green, blue);
  return clamp01((max - min) / max);
}

export class LocalVision {
  static sample(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    xNorm: number,
    yNorm: number,
    radiusPx: number,
    previous?: Uint8ClampedArray,
  ): SensorySample {
    validateImage(pixels, width, height, previous);
    if (!Number.isFinite(xNorm) || !Number.isFinite(yNorm)) {
      throw new RangeError('normalized coordinates must be finite');
    }
    if (!Number.isInteger(radiusPx) || radiusPx < 0) {
      throw new RangeError('radiusPx must be a non-negative integer');
    }

    const centerX = Math.round(clamp01(xNorm) * (width - 1));
    const centerY = Math.round(clamp01(yNorm) * (height - 1));
    const minX = Math.max(0, centerX - radiusPx);
    const maxX = Math.min(width - 1, centerX + radiusPx);
    const minY = Math.max(0, centerY - radiusPx);
    const maxY = Math.min(height - 1, centerY + radiusPx);

    const luminances: number[] = [];
    let saturationTotal = 0;
    let motionTotal = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const offset = (y * width + x) * 4;
        const luminance = luminanceAt(pixels, offset);
        luminances.push(luminance);
        saturationTotal += saturationAt(pixels, offset);
        if (previous) {
          motionTotal += Math.abs(luminance - luminanceAt(previous, offset));
        }
      }
    }

    const count = luminances.length;
    const luminance = luminances.reduce((sum, value) => sum + value, 0) / count;
    const variance =
      luminances.reduce((sum, value) => sum + (value - luminance) ** 2, 0) / count;
    const contrast = clamp01(Math.sqrt(variance) * 2);

    let edgeTotal = 0;
    let edgeSamples = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const offset = (y * width + x) * 4;
        const current = luminanceAt(pixels, offset);
        let dx = 0;
        let dy = 0;
        if (x < maxX) {
          dx = luminanceAt(pixels, (y * width + x + 1) * 4) - current;
        }
        if (y < maxY) {
          dy = luminanceAt(pixels, ((y + 1) * width + x) * 4) - current;
        }
        if (x < maxX || y < maxY) {
          edgeTotal += Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
          edgeSamples += 1;
        }
      }
    }

    return {
      luminance: clamp01(luminance),
      saturation: clamp01(saturationTotal / count),
      contrast,
      edge: clamp01(edgeSamples === 0 ? 0 : edgeTotal / edgeSamples),
      motion: clamp01(previous ? motionTotal / count : 0),
    };
  }
}
