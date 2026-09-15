import type * as THREE from 'three';
import { LocalVision, type SensorySample } from './LocalVision';

export interface ReadbackRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface RenderTargetReader {
  readRenderTargetPixels(
    target: THREE.WebGLRenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: Uint8Array,
  ): void;
}

export const MAX_EDITED_PATCH_SIZE = 32;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function validateDimension(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

export function calculateReadbackRect(
  targetWidth: number,
  targetHeight: number,
  xNorm: number,
  yNorm: number,
  radiusPx: number,
): ReadbackRect {
  validateDimension('targetWidth', targetWidth);
  validateDimension('targetHeight', targetHeight);
  if (!Number.isFinite(radiusPx) || radiusPx < 0) {
    throw new RangeError('radiusPx must be finite and non-negative');
  }

  const x01 = clamp(Number.isFinite(xNorm) ? xNorm : 0, 0, 1);
  const y01 = clamp(Number.isFinite(yNorm) ? yNorm : 0, 0, 1);
  const radius = Math.floor(radiusPx);
  const requestedSize = Math.min(MAX_EDITED_PATCH_SIZE, radius * 2 + 1);
  const width = Math.min(targetWidth, Math.max(1, requestedSize));
  const height = Math.min(targetHeight, Math.max(1, requestedSize));

  const centerX = Math.round(x01 * (targetWidth - 1));
  const centerTopY = Math.round(y01 * (targetHeight - 1));
  const centerWebGLY = targetHeight - 1 - centerTopY;

  const x = clamp(
    centerX - Math.floor(width / 2),
    0,
    targetWidth - width,
  );
  const y = clamp(
    centerWebGLY - Math.floor(height / 2),
    0,
    targetHeight - height,
  );

  return { x, y, width, height };
}

export function flipReadbackRows(
  bottomUp: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  validateDimension('width', width);
  validateDimension('height', height);
  const rowBytes = width * 4;
  const expectedLength = rowBytes * height;
  if (bottomUp.length !== expectedLength) {
    throw new RangeError(
      `readback byte length ${bottomUp.length} does not match ${width}x${height} RGBA (${expectedLength})`,
    );
  }

  const topDown = new Uint8ClampedArray(expectedLength);
  for (let sourceRow = 0; sourceRow < height; sourceRow += 1) {
    const targetRow = height - 1 - sourceRow;
    const sourceOffset = sourceRow * rowBytes;
    const targetOffset = targetRow * rowBytes;
    topDown.set(
      bottomUp.subarray(sourceOffset, sourceOffset + rowBytes),
      targetOffset,
    );
  }
  return topDown;
}

export function readEditedPatch(
  reader: RenderTargetReader,
  target: THREE.WebGLRenderTarget,
  targetWidth: number,
  targetHeight: number,
  xNorm: number,
  yNorm: number,
  radiusPx: number,
): ImageDataLike {
  const rect = calculateReadbackRect(
    targetWidth,
    targetHeight,
    xNorm,
    yNorm,
    radiusPx,
  );
  const bottomUp = new Uint8Array(rect.width * rect.height * 4);
  reader.readRenderTargetPixels(
    target,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    bottomUp,
  );

  return {
    data: flipReadbackRows(bottomUp, rect.width, rect.height),
    width: rect.width,
    height: rect.height,
  };
}

export function sampleEditedPatch(
  current: ImageDataLike,
  previous?: ImageDataLike,
): SensorySample {
  validateDimension('current.width', current.width);
  validateDimension('current.height', current.height);

  let previousPixels: Uint8ClampedArray | undefined;
  if (previous) {
    if (previous.width !== current.width || previous.height !== current.height) {
      throw new RangeError('previous edited patch dimensions must match current patch');
    }
    previousPixels = previous.data;
  }

  return LocalVision.sample(
    current.data,
    current.width,
    current.height,
    0.5,
    0.5,
    Math.max(current.width, current.height),
    previousPixels,
  );
}
