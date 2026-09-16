import { describe, expect, it, vi } from 'vitest';
import { BrainWorkerClient } from '../../src/brain/BrainWorkerClient';

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();

  emitError(message: string): void {
    this.onerror?.({
      message,
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent);
  }

  emitMessageError(data: unknown): void {
    this.onmessageerror?.({ data } as MessageEvent<unknown>);
  }
}

describe('BrainWorkerClient fatal forwarding', () => {
  it('forwards worker runtime errors as fatal brain errors', () => {
    const worker = new FakeWorker();
    const client = new BrainWorkerClient(() => worker as unknown as Worker);
    const error = vi.fn();
    client.onError(error);

    worker.emitError('worker crashed');

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toEqual({
      type: 'error',
      message: 'Brain worker crashed: worker crashed',
    });
  });

  it('forwards message decoding failures as fatal brain errors', () => {
    const worker = new FakeWorker();
    const client = new BrainWorkerClient(() => worker as unknown as Worker);
    const error = vi.fn();
    client.onError(error);

    worker.emitMessageError({ malformed: true });

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toEqual({
      type: 'error',
      message: 'Brain worker message could not be decoded',
    });
  });

  it('removes native fatal handlers when disposed', () => {
    const worker = new FakeWorker();
    const client = new BrainWorkerClient(() => worker as unknown as Worker);
    client.dispose();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
  });
});
