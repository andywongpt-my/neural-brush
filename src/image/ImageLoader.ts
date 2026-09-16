const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 25 * 1024 * 1024;

export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_IMAGE_PIXELS = 40_000_000;

export function validateImageDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('decoded image dimensions must be positive integers');
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new RangeError(
      `decoded image dimensions must not exceed ${MAX_IMAGE_DIMENSION}px per axis`,
    );
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new RangeError(
      `decoded image must not exceed ${MAX_IMAGE_PIXELS} pixels`,
    );
  }
}

export class ImageLoader {
  static async decode(file: File): Promise<ImageBitmap> {
    if (!ACCEPTED.has(file.type)) throw new Error('Unsupported image type');
    if (file.size > MAX_BYTES) throw new Error('Image exceeds 25 MiB');

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new Error('Could not decode image');
    }

    try {
      validateImageDimensions(bitmap.width, bitmap.height);
      return bitmap;
    } catch (cause) {
      bitmap.close();
      throw cause;
    }
  }
}
