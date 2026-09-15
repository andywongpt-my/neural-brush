import { describe, expect, it } from 'vitest';
import { ImageLoader } from '../../src/image/ImageLoader';

describe('ImageLoader validation', () => {
  it('rejects unsupported image types before decoding', async () => {
    const file = new File(['x'], 'x.gif', { type: 'image/gif' });
    await expect(ImageLoader.decode(file)).rejects.toThrow('Unsupported image type');
  });

  it('rejects files larger than 25 MiB', async () => {
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    });
    await expect(ImageLoader.decode(file)).rejects.toThrow('Image exceeds 25 MiB');
  });
});
