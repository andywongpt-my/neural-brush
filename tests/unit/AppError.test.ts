import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/app/AppError';

describe('AppError', () => {
  it('uses a user-safe WebGL message', () => {
    expect(new AppError('WEBGL_UNAVAILABLE').message).toContain('WebGL');
  });
});
