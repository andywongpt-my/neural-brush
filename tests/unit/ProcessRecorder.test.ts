import { afterEach, describe, expect, it } from 'vitest';
import {
  ProcessRecorder,
  ProcessRecorderError,
} from '../../src/export/ProcessRecorder';

class FakeTrack {
  stopped = false;
  stop(): void {
    this.stopped = true;
  }
}

class FakeStream {
  readonly track = new FakeTrack();
  getTracks(): FakeTrack[] {
    return [this.track];
  }
}

interface FakeRecorderEventMap {
  dataavailable: BlobEvent;
  stop: Event;
  error: Event;
}

class FakeMediaRecorder {
  static supported = new Set<string>();
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported(mime: string): boolean {
    return this.supported.has(mime);
  }

  readonly mimeType: string;
  readonly stream: FakeStream;
  state: RecordingState = 'inactive';
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream as unknown as FakeStream;
    this.mimeType = options?.mimeType ?? '';
    FakeMediaRecorder.instances.push(this);
  }

  addEventListener<K extends keyof FakeRecorderEventMap>(
    type: K,
    listener: (event: FakeRecorderEventMap[K]) => void,
  ): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener as (event: Event) => void);
    this.listeners.set(type, bucket);
  }

  removeEventListener<K extends keyof FakeRecorderEventMap>(
    type: K,
    listener: (event: FakeRecorderEventMap[K]) => void,
  ): void {
    this.listeners.get(type)?.delete(listener as (event: Event) => void);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.emit('stop', new Event('stop'));
  }

  emitChunk(blob: Blob): void {
    const event = new Event('dataavailable') as BlobEvent;
    Object.defineProperty(event, 'data', { value: blob });
    this.emit('dataavailable', event);
  }

  private emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const originalMediaRecorder = globalThis.MediaRecorder;

function installRecorderSupport(...mimeTypes: string[]): void {
  FakeMediaRecorder.supported = new Set(mimeTypes);
  FakeMediaRecorder.instances = [];
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    writable: true,
    value: FakeMediaRecorder,
  });
}

function fakeCanvas(stream: FakeStream): HTMLCanvasElement {
  return {
    captureStream: (fps?: number) => {
      expect(fps).toBe(30);
      return stream as unknown as MediaStream;
    },
  } as unknown as HTMLCanvasElement;
}

afterEach(() => {
  if (originalMediaRecorder === undefined) {
    Reflect.deleteProperty(globalThis, 'MediaRecorder');
  } else {
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: originalMediaRecorder,
    });
  }
  FakeMediaRecorder.supported.clear();
  FakeMediaRecorder.instances = [];
});

describe('ProcessRecorder capability', () => {
  it('reports unsupported without captureStream or MediaRecorder', () => {
    Reflect.deleteProperty(globalThis, 'MediaRecorder');
    expect(ProcessRecorder.isSupported({} as HTMLCanvasElement)).toBe(false);
  });

  it('uses vp9 then vp8 then plain webm in priority order', () => {
    const stream = new FakeStream();
    const canvas = fakeCanvas(stream);

    installRecorderSupport(
      'video/webm',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9',
    );
    expect(ProcessRecorder.preferredMimeType(canvas)).toBe('video/webm;codecs=vp9');

    installRecorderSupport('video/webm', 'video/webm;codecs=vp8');
    expect(ProcessRecorder.preferredMimeType(canvas)).toBe('video/webm;codecs=vp8');

    installRecorderSupport('video/webm');
    expect(ProcessRecorder.preferredMimeType(canvas)).toBe('video/webm');

    installRecorderSupport();
    expect(ProcessRecorder.preferredMimeType(canvas)).toBeNull();
  });
});

describe('ProcessRecorder lifecycle', () => {
  it('rejects start while recording and stop while idle', async () => {
    installRecorderSupport('video/webm');
    const stream = new FakeStream();
    const recorder = new ProcessRecorder();

    await expect(recorder.stop()).rejects.toBeInstanceOf(ProcessRecorderError);
    recorder.start(fakeCanvas(stream));
    expect(() => recorder.start(fakeCanvas(stream))).toThrow(ProcessRecorderError);
  });

  it('collects non-empty chunks, stops tracks, returns WebM, and can record again', async () => {
    installRecorderSupport('video/webm;codecs=vp8');
    const stream1 = new FakeStream();
    const recorder = new ProcessRecorder();
    recorder.start(fakeCanvas(stream1));

    const media1 = FakeMediaRecorder.instances.at(-1)!;
    media1.emitChunk(new Blob([]));
    media1.emitChunk(new Blob(['first'], { type: 'video/webm;codecs=vp8' }));
    const blob1 = await recorder.stop();

    expect(blob1.type).toBe('video/webm;codecs=vp8');
    expect(blob1.size).toBeGreaterThan(0);
    expect(stream1.track.stopped).toBe(true);
    expect(recorder.isRecording).toBe(false);

    const stream2 = new FakeStream();
    recorder.start(fakeCanvas(stream2));
    const media2 = FakeMediaRecorder.instances.at(-1)!;
    media2.emitChunk(new Blob(['second'], { type: 'video/webm;codecs=vp8' }));
    const blob2 = await recorder.stop();
    expect(blob2.size).toBeGreaterThan(0);
    expect(stream2.track.stopped).toBe(true);
  });

  it('rejects unsupported browser capability and invalid fps', () => {
    installRecorderSupport();
    const stream = new FakeStream();
    const recorder = new ProcessRecorder();
    expect(() => recorder.start(fakeCanvas(stream))).toThrow(ProcessRecorderError);

    installRecorderSupport('video/webm');
    expect(() => recorder.start(fakeCanvas(stream), 0)).toThrow(RangeError);
  });
});
