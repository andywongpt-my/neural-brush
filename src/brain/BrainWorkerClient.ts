import {
  isWorkerEvent,
  type BrainErrorEvent,
  type BrainStateEvent,
  type WorkerCommand,
} from './BrainProtocol';
import type { EngineGraph, ModulationSnapshot } from './BrainRuntimeTypes';

type StateCallback = (state: BrainStateEvent) => void;
type ErrorCallback = (error: BrainErrorEvent) => void;
type ReadyCallback = () => void;
type WorkerFactory = () => Worker;

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./BrainWorker.ts', import.meta.url), {
    type: 'module',
  });
}

function cloneGraph(graph: EngineGraph): EngineGraph {
  return {
    nodeCount: graph.nodeCount,
    source: graph.source.slice(),
    target: graph.target.slice(),
    weight: graph.weight.slice(),
    inputPorts: graph.inputPorts.slice(),
    turnLeftPorts: graph.turnLeftPorts.slice(),
    turnRightPorts: graph.turnRightPorts.slice(),
    forwardPorts: graph.forwardPorts.slice(),
  };
}

function cloneModulation(value: ModulationSnapshot): ModulationSnapshot {
  return {
    stimulation: value.stimulation.slice(),
    inhibition: value.inhibition.slice(),
    connectionGain: value.connectionGain.slice(),
  };
}

export class BrainWorkerClient {
  private readonly worker: Worker;
  private readonly stateCallbacks = new Set<StateCallback>();
  private readonly errorCallbacks = new Set<ErrorCallback>();
  private readonly readyCallbacks = new Set<ReadyCallback>();
  private disposed = false;

  constructor(workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.worker = workerFactory();
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerEvent(event.data)) return;
      switch (event.data.type) {
        case 'ready':
          for (const callback of this.readyCallbacks) callback();
          break;
        case 'state':
          for (const callback of this.stateCallbacks) callback(event.data);
          break;
        case 'error':
          for (const callback of this.errorCallbacks) callback(event.data);
          break;
      }
    };
    this.worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      this.emitFatal(
        `Brain worker crashed: ${event.message || 'unknown worker error'}`,
      );
    };
    this.worker.onmessageerror = () => {
      this.emitFatal('Brain worker message could not be decoded');
    };
  }

  init(graph: EngineGraph, seed: number): void {
    this.assertActive();
    const graphCopy = cloneGraph(graph);
    const command: WorkerCommand = { type: 'init', graph: graphCopy, seed };
    const transfers: Transferable[] = [
      graphCopy.source.buffer as ArrayBuffer,
      graphCopy.target.buffer as ArrayBuffer,
      graphCopy.weight.buffer as ArrayBuffer,
      graphCopy.inputPorts.buffer as ArrayBuffer,
      graphCopy.turnLeftPorts.buffer as ArrayBuffer,
      graphCopy.turnRightPorts.buffer as ArrayBuffer,
      graphCopy.forwardPorts.buffer as ArrayBuffer,
    ];
    this.worker.postMessage(command, transfers);
  }

  sendSensory(drive: Float32Array): void {
    this.assertActive();
    const copy = drive.slice();
    this.worker.postMessage(
      { type: 'sensory', drive: copy } satisfies WorkerCommand,
      [copy.buffer as ArrayBuffer],
    );
  }

  setModulation(value: ModulationSnapshot): void {
    this.assertActive();
    const copy = cloneModulation(value);
    this.worker.postMessage(
      { type: 'modulation', modulation: copy } satisfies WorkerCommand,
      [
        copy.stimulation.buffer as ArrayBuffer,
        copy.inhibition.buffer as ArrayBuffer,
        copy.connectionGain.buffer as ArrayBuffer,
      ],
    );
  }

  pause(): void {
    this.postLifecycle({ type: 'pause' });
  }

  resume(): void {
    this.postLifecycle({ type: 'resume' });
  }

  reset(): void {
    this.postLifecycle({ type: 'reset' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    try {
      this.worker.postMessage({ type: 'dispose' } satisfies WorkerCommand);
    } finally {
      this.worker.terminate();
      this.disposed = true;
      this.stateCallbacks.clear();
      this.errorCallbacks.clear();
      this.readyCallbacks.clear();
    }
  }

  onState(callback: StateCallback): () => void {
    this.assertActive();
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this.assertActive();
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  onReady(callback: ReadyCallback): () => void {
    this.assertActive();
    this.readyCallbacks.add(callback);
    return () => this.readyCallbacks.delete(callback);
  }

  private emitFatal(message: string): void {
    const event: BrainErrorEvent = { type: 'error', message };
    for (const callback of this.errorCallbacks) callback(event);
  }

  private postLifecycle(command: WorkerCommand): void {
    this.assertActive();
    this.worker.postMessage(command);
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('BrainWorkerClient has been disposed');
    }
  }
}
