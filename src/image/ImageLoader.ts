const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 25 * 1024 * 1024;

export class ImageLoader {
  static async decode(file: File): Promise<ImageBitmap> {
    if (!ACCEPTED.has(file.type)) throw new Error('Unsupported image type');
    if (file.size > MAX_BYTES) throw new Error('Image exceeds 25 MiB');

    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new Error('Could not decode image');
    }
  }
}
