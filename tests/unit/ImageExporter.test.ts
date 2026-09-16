import { describe, expect, it } from 'vitest';
import { flipRowsRGBA } from '../../src/export/ImageExporter';

function pixel(r: number, g: number, b: number, a = 255): number[] {
  return [r, g, b, a];
}

describe('flipRowsRGBA', () => {
  it('converts a 2x2 WebGL bottom-up buffer into top-down row order exactly', () => {
    const bottomLeft = pixel(10, 11, 12);
    const bottomRight = pixel(20, 21, 22);
    const topLeft = pixel(30, 31, 32);
    const topRight = pixel(40, 41, 42);
    const input = new Uint8Array([
      ...bottomLeft,
      ...bottomRight,
      ...topLeft,
      ...topRight,
    ]);

    const output = flipRowsRGBA(input, 2, 2);

    expect(Array.from(output)).toEqual([
      ...topLeft,
      ...topRight,
      ...bottomLeft,
      ...bottomRight,
    ]);
    expect(Array.from(input)).toEqual([
      ...bottomLeft,
      ...bottomRight,
      ...topLeft,
      ...topRight,
    ]);
    expect(output).not.toBe(input);
  });

  it('keeps a single row unchanged while returning a defensive copy', () => {
    const input = new Uint8Array([...pixel(1, 2, 3), ...pixel(4, 5, 6)]);
    const output = flipRowsRGBA(input, 2, 1);
    expect(Array.from(output)).toEqual(Array.from(input));
    expect(output).not.toBe(input);
  });

  it('rejects invalid dimensions or buffer lengths', () => {
    expect(() => flipRowsRGBA(new Uint8Array(4), 0, 1)).toThrow(RangeError);
    expect(() => flipRowsRGBA(new Uint8Array(4), 1.5, 1)).toThrow(RangeError);
    expect(() => flipRowsRGBA(new Uint8Array(4), 1, 2)).toThrow(RangeError);
  });
});
