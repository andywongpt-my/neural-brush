import * as THREE from 'three';
import { AppError } from '../app/AppError';

export const PNG_MIME = 'image/png';
export const JPEG_MIME = 'image/jpeg';
export const DEFAULT_JPEG_QUALITY = 0.92;

export function flipRowsRGBA(
  input: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('image dimensions must be positive integers');
  }

  const rowBytes = width * 4;
  const expectedBytes = rowBytes * height;
  if (input.byteLength !== expectedBytes) {
    throw new RangeError(
      `RGBA buffer has ${input.byteLength} bytes; expected ${expectedBytes}`,
    );
  }

  const output = new Uint8Array(expectedBytes);
  for (let sourceRow = 0; sourceRow < height; sourceRow += 1) {
    const destinationRow = height - 1 - sourceRow;
    const sourceOffset = sourceRow * rowBytes;
    const destinationOffset = destinationRow * rowBytes;
    output.set(
      input.subarray(sourceOffset, sourceOffset + rowBytes),
      destinationOffset,
    );
  }
  return output;
}

async function canvasToBlob(
  pixels: Uint8Array,
  width: number,
  height: number,
  mimeType: typeof PNG_MIME | typeof JPEG_MIME,
  quality?: number,
): Promise<Blob> {
  const clamped = new Uint8ClampedArray(pixels.byteLength);
  clamped.set(pixels);
  const imageData = new ImageData(clamped, width, height);

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D export context is unavailable');
    context.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  if (typeof document === 'undefined') {
    throw new Error('No canvas implementation is available for image export');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D export context is unavailable');
  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas returned an empty export Blob'));
        },
        mimeType,
        quality,
      );
    } catch (cause) {
      reject(cause);
    }
  });
}

async function exportTarget(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  mimeType: typeof PNG_MIME | typeof JPEG_MIME,
  quality?: number,
): Promise<Blob> {
  try {
    const width = target.width;
    const height = target.height;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new RangeError('render target dimensions are invalid');
    }

    const bottomUp = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, bottomUp);
    const topDown = flipRowsRGBA(bottomUp, width, height);
    const blob = await canvasToBlob(
      topDown,
      width,
      height,
      mimeType,
      quality,
    );
    if (blob.size <= 0) throw new Error('Image export produced an empty Blob');
    return blob;
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError('EXPORT_FAILED', cause);
  }
}

export class ImageExporter {
  static exportPNG(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
  ): Promise<Blob> {
    return exportTarget(renderer, target, PNG_MIME);
  }

  static exportJPEG(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    quality = DEFAULT_JPEG_QUALITY,
  ): Promise<Blob> {
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
      return Promise.reject(
        new AppError(
          'EXPORT_FAILED',
          new RangeError('JPEG quality must stay within 0..1'),
        ),
      );
    }
    return exportTarget(renderer, target, JPEG_MIME, quality);
  }
}
