import { BrainEngine } from './BrainEngine';
import { isWorkerCommand, type WorkerCommand, type WorkerEvent } from './BrainProtocol';
import type { EngineGraph, ModulationSnapshot } from './BrainRuntimeTypes';

export const BRAIN_STEP_MS = 1000 / 60;
const PUBLISH_EVERY_STEPS = 2;

interface WorkerScopeLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkerEvent, transfer?: Transferable[]): void;
  close(): void;
}

const scope = self as unknown as WorkerScopeLike;

let engine: BrainEngine | null = null;
let graph: EngineGraph | null = null;
let sensoryDrive = new Float32Array();
let modulation: ModulationSnapshot = {
  stimulation: new Float32Array(),
  inhibition: new Float32Array(),
  connectionGain: new Float32Array(),
};
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let paused = false;
let stepsSincePublish = 0;

function neutralModulation(activeGraph: EngineGraph): ModulationSnapshot {
  const connectionGain = new Float32Array(activeGraph.weight.length);
  connectionGain.fill(1);
  return {
    stimulation: new Float32Array(activeGraph.nodeCount),
    inhibition: new Float32Array(activeGraph.nodeCount),
    connectionGain,
  };
}

function postError(error: unknown): void {
  scope.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function validateModulation(
  value: ModulationSnapshot,
  activeGraph: EngineGraph,
): ModulationSnapshot {
  if (
    value.stimulation.length !== activeGraph.nodeCount ||
    value.inhibition.length !== activeGraph.nodeCount ||
    value.connectionGain.length !== activeGraph.weight.length
  ) {
    throw new RangeError('modulation array lengths do not match active graph');
  }

  for (const valueItem of value.stimulation) {
    if (!Number.isFinite(valueItem) || valueItem < 0 || valueItem > 1) {
      throw new RangeError('stimulation values must stay within 0..1');
    }
  }
  for (const valueItem of value.inhibition) {
    if (!Number.isFinite(valueItem) || valueItem < 0 || valueItem > 1) {
      throw new RangeError('inhibition values must stay within 0..1');
    }
  }
  for (const valueItem of value.connectionGain) {
    if (!Number.isFinite(valueItem) || valueItem < 0 || valueItem > 2) {
      throw new RangeError('connection gain must stay within 0..2');
    }
  }

  return {
    stimulation: value.stimulation.slice(),
    inhibition: value.inhibition.slice(),
    connectionGain: value.connectionGain.slice(),
  };
}

function tick(): void {
  if (paused || !engine) return;

  try {
    const result = engine.step(BRAIN_STEP_MS, sensoryDrive, modulation);
    stepsSincePublish += 1;
    if (stepsSincePublish >= PUBLISH_EVERY_STEPS) {
      stepsSincePublish = 0;
      const activation = result.activation;
      scope.postMessage(
        {
          type: 'state',
          activation,
          behavior: result.behavior,
        },
        [activation.buffer as ArrayBuffer],
      );
    }
  } catch (error) {
    paused = true;
    postError(error);
  }
}

function startLoop(): void {
  if (intervalHandle !== null) return;
  intervalHandle = setInterval(tick, BRAIN_STEP_MS);
}

function stopLoop(): void {
  if (intervalHandle === null) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}

function handleCommand(command: WorkerCommand): void {
  switch (command.type) {
    case 'init': {
      stopLoop();
      graph = command.graph;
      engine = new BrainEngine(graph, command.seed);
      sensoryDrive = new Float32Array(graph.nodeCount);
      modulation = neutralModulation(graph);
      paused = false;
      stepsSincePublish = 0;
      startLoop();
      scope.postMessage({ type: 'ready' });
      return;
    }
    case 'sensory': {
      if (!graph) throw new Error('brain worker is not initialized');
      if (command.drive.length !== graph.nodeCount) {
        throw new RangeError('sensory drive length does not match nodeCount');
      }
      sensoryDrive = command.drive.slice();
      return;
    }
    case 'modulation': {
      if (!graph) throw new Error('brain worker is not initialized');
      modulation = validateModulation(command.modulation, graph);
      return;
    }
    case 'pause':
      paused = true;
      return;
    case 'resume':
      if (!engine) throw new Error('brain worker is not initialized');
      paused = false;
      return;
    case 'reset': {
      if (!engine || !graph) throw new Error('brain worker is not initialized');
      engine.reset();
      sensoryDrive.fill(0);
      modulation = neutralModulation(graph);
      paused = false;
      stepsSincePublish = 0;
      return;
    }
    case 'dispose':
      stopLoop();
      engine = null;
      graph = null;
      sensoryDrive = new Float32Array();
      modulation = {
        stimulation: new Float32Array(),
        inhibition: new Float32Array(),
        connectionGain: new Float32Array(),
      };
      scope.close();
      return;
  }
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  if (!isWorkerCommand(event.data)) {
    postError(new Error('invalid brain worker command'));
    return;
  }

  try {
    handleCommand(event.data);
  } catch (error) {
    postError(error);
  }
};
