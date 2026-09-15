import { describe, expect, it } from 'vitest';
import { sampleEditedPatch } from '../../src/vision/EditedImageSampler';

const solidPatch = (width: number, height: number, value: number) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return { data, width, height };
};

describe('edited-image sensory feedback', () => {
  it('changes the next sensory sample after the edited pixels change', () => {
    const before = solidPatch(3, 3, 0);
    const after = solidPatch(3, 3, 0);
    const center = (1 * 3 + 1) * 4;
    after.data[center] = 255;
    after.data[center + 1] = 255;
    after.data[center + 2] = 255;

    const first = sampleEditedPatch(before);
    const second = sampleEditedPatch(after, before);

    expect(first.luminance).toBe(0);
    expect(second.luminance).toBeGreaterThan(first.luminance);
    expect(second.contrast).toBeGreaterThan(first.contrast);
    expect(second.edge).toBeGreaterThan(first.edge);
    expect(second.motion).toBeGreaterThan(0);
  });
});
