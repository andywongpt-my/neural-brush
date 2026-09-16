export type AppErrorCode =
  | 'WEBGL_UNAVAILABLE'
  | 'IMAGE_DECODE'
  | 'EXPORT_FAILED'
  | 'APP_INIT';

const MESSAGES: Record<AppErrorCode, string> = {
  WEBGL_UNAVAILABLE:
    'Neural Brush needs WebGL2/WebGL support. Try a current browser or enable hardware acceleration.',
  IMAGE_DECODE: 'Could not load that image. Use a valid PNG, JPEG, or WebP under 25 MiB.',
  EXPORT_FAILED: 'Could not export the artwork. Your current edit is unchanged; try again.',
  APP_INIT: 'Neural Brush could not start correctly. Reload the page and try again.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  override readonly cause: unknown;

  constructor(code: AppErrorCode, cause?: unknown) {
    super(MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}
