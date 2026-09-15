import { describe, expect, it } from 'vitest';
import { APP_NAME } from '../../src/app/constants';

describe('application constants', () => {
  it('uses the approved product name', () => {
    expect(APP_NAME).toBe('Neural Brush');
  });
});
