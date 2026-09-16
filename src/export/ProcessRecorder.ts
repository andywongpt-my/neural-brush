export const PROCESS_RECORDING_FPS = 30;
export const PROCESS_RECORDING_FILENAME = 'neural-brush-process.webm';

const WEBM_MIME_PRIORITY = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

export class ProcessRecorderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProcessRecorderError';
  }
}

export class ProcessRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private mimeType: string | null = null;

  get isRecording(): boolean {
    return this.recorder !== null;
  }

  static preferredMimeType(canvas: HTMLCanvasElement): string | null {
    if (
      typeof canvas.captureStream !== 'function' ||
      typeof globalThis.MediaRecorder === 'undefined' ||
      typeof globalThis.MediaRecorder.isTypeSupported !== 'function'
    ) {
      return null;
    }

    return (
      WEBM_MIME_PRIORITY.find((mimeType) =>
        globalThis.MediaRecorder.isTypeSupported(mimeType),
      ) ?? null
    );
  }

  static isSupported(canvas: HTMLCanvasElement): boolean {
    return this.preferredMimeType(canvas) !== null;
  }

  start(canvas: HTMLCanvasElement, fps = PROCESS_RECORDING_FPS): void {
    if (!Number.isFinite(fps) || fps <= 0) {
      throw new RangeError('recording fps must be finite and positive');
    }
    if (this.recorder) {
      throw new ProcessRecorderError('process recording is already active');
    }

    const mimeType = ProcessRecorder.preferredMimeType(canvas);
    if (!mimeType) {
      throw new ProcessRecorderError(
        'WebM process recording is not supported by this browser',
      );
    }

    let stream: MediaStream;
    let recorder: MediaRecorder;
    try {
      stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (cause) {
      throw new ProcessRecorderError('process recording could not start', {
        cause,
      });
    }

    this.chunks = [];
    this.stream = stream;
    this.recorder = recorder;
    this.mimeType = mimeType;

    recorder.addEventListener('dataavailable', this.handleDataAvailable);
    try {
      recorder.start();
    } catch (cause) {
      recorder.removeEventListener('dataavailable', this.handleDataAvailable);
      this.stopTracks(stream);
      this.clearState();
      throw new ProcessRecorderError('process recording could not start', {
        cause,
      });
    }
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder;
    const stream = this.stream;
    const mimeType = this.mimeType;
    if (!recorder || !stream || !mimeType) {
      return Promise.reject(
        new ProcessRecorderError('process recording is not active'),
      );
    }

    return new Promise<Blob>((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        recorder.removeEventListener('dataavailable', this.handleDataAvailable);
        recorder.removeEventListener('stop', onStop);
        recorder.removeEventListener('error', onError);
        this.stopTracks(stream);
        this.clearState();
      };

      const onStop = (): void => {
        if (settled) return;
        settled = true;
        const blob = new Blob(this.chunks, { type: mimeType });
        cleanup();
        resolve(blob);
      };

      const onError = (event: Event): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new ProcessRecorderError('process recording failed', {
            cause: event,
          }),
        );
      };

      recorder.addEventListener('stop', onStop);
      recorder.addEventListener('error', onError);

      try {
        recorder.stop();
      } catch (cause) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new ProcessRecorderError('process recording could not stop', {
            cause,
          }),
        );
      }
    });
  }

  private readonly handleDataAvailable = (event: BlobEvent): void => {
    if (event.data.size > 0) this.chunks.push(event.data);
  };

  private stopTracks(stream: MediaStream): void {
    for (const track of stream.getTracks()) track.stop();
  }

  private clearState(): void {
    this.recorder = null;
    this.stream = null;
    this.mimeType = null;
    this.chunks = [];
  }
}
