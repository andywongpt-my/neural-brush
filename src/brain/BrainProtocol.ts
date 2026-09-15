import type {
  BehaviorState,
  EngineGraph,
  ModulationSnapshot,
} from './BrainRuntimeTypes';

export interface BrainInitCommand {
  type: 'init';
  graph: EngineGraph;
  seed: number;
}

export interface BrainSensoryCommand {
  type: 'sensory';
  drive: Float32Array;
}

export interface BrainModulationCommand {
  type: 'modulation';
  modulation: ModulationSnapshot;
}

export interface BrainPauseCommand {
  type: 'pause';
}

export interface BrainResumeCommand {
  type: 'resume';
}

export interface BrainResetCommand {
  type: 'reset';
}

export interface BrainDisposeCommand {
  type: 'dispose';
}

export type WorkerCommand =
  | BrainInitCommand
  | BrainSensoryCommand
  | BrainModulationCommand
  | BrainPauseCommand
  | BrainResumeCommand
  | BrainResetCommand
  | BrainDisposeCommand;

export interface BrainReadyEvent {
  type: 'ready';
}

export interface BrainStateEvent {
  type: 'state';
  activation: Float32Array;
  behavior: BehaviorState;
}

export interface BrainErrorEvent {
  type: 'error';
  message: string;
}

export type WorkerEvent = BrainReadyEvent | BrainStateEvent | BrainErrorEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEngineGraph(value: unknown): value is EngineGraph {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.nodeCount) &&
    typeof value.nodeCount === 'number' &&
    value.nodeCount > 0 &&
    value.source instanceof Uint32Array &&
    value.target instanceof Uint32Array &&
    value.weight instanceof Uint32Array &&
    value.inputPorts instanceof Uint32Array &&
    value.turnLeftPorts instanceof Uint32Array &&
    value.turnRightPorts instanceof Uint32Array &&
    value.forwardPorts instanceof Uint32Array
  );
}

function isModulationSnapshot(value: unknown): value is ModulationSnapshot {
  if (!isRecord(value)) return false;
  return (
    value.stimulation instanceof Float32Array &&
    value.inhibition instanceof Float32Array &&
    value.connectionGain instanceof Float32Array
  );
}

export function isWorkerCommand(value: unknown): value is WorkerCommand {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'init':
      return isEngineGraph(value.graph) && typeof value.seed === 'number' && Number.isFinite(value.seed);
    case 'sensory':
      return value.drive instanceof Float32Array;
    case 'modulation':
      return isModulationSnapshot(value.modulation);
    case 'pause':
    case 'resume':
    case 'reset':
    case 'dispose':
      return true;
    default:
      return false;
  }
}

function isBehaviorState(value: unknown): value is BehaviorState {
  if (!isRecord(value)) return false;
  return ['turn', 'forward', 'dwell', 'arousal'].every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
  );
}

export function isWorkerEvent(value: unknown): value is WorkerEvent {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'ready':
      return true;
    case 'state':
      return value.activation instanceof Float32Array && isBehaviorState(value.behavior);
    case 'error':
      return typeof value.message === 'string';
    default:
      return false;
  }
}
