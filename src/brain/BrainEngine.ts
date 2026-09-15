import { SeededRandom } from './SeededRandom';
import type {
  BehaviorState,
  BrainStepResult,
  EngineGraph,
  ModulationSnapshot,
} from './BrainRuntimeTypes';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const normalizeWeight = (weight: number): number =>
  Math.tanh(Math.log1p(weight) / 4);
const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

function assertNodeIndex(name: string, index: number, nodeCount: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= nodeCount) {
    throw new RangeError(`${name} contains invalid node index ${index}`);
  }
}

function assertPortArray(
  name: string,
  ports: Uint32Array,
  nodeCount: number,
  required: boolean,
): void {
  if (required && ports.length === 0) {
    throw new Error(`${name} must contain at least one source-verified node`);
  }
  for (const index of ports) {
    assertNodeIndex(name, index, nodeCount);
  }
}

function validateGraph(graph: EngineGraph): void {
  if (!Number.isInteger(graph.nodeCount) || graph.nodeCount <= 0) {
    throw new RangeError('nodeCount must be a positive integer');
  }

  const edgeCount = graph.weight.length;
  if (graph.source.length !== edgeCount || graph.target.length !== edgeCount) {
    throw new Error('source, target, and weight arrays must have equal length');
  }

  for (let edge = 0; edge < edgeCount; edge += 1) {
    assertNodeIndex('source', graph.source[edge], graph.nodeCount);
    assertNodeIndex('target', graph.target[edge], graph.nodeCount);
    if (!Number.isInteger(graph.weight[edge]) || graph.weight[edge] <= 0) {
      throw new RangeError(`weight[${edge}] must be a positive integer`);
    }
  }

  assertPortArray('inputPorts', graph.inputPorts, graph.nodeCount, false);
  assertPortArray('turnLeftPorts', graph.turnLeftPorts, graph.nodeCount, true);
  assertPortArray('turnRightPorts', graph.turnRightPorts, graph.nodeCount, true);
  assertPortArray('forwardPorts', graph.forwardPorts, graph.nodeCount, false);
}

function copyGraph(graph: EngineGraph): EngineGraph {
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

function mean(values: Float32Array, indices?: Uint32Array): number {
  if (indices) {
    if (indices.length === 0) return 0;
    let total = 0;
    for (const index of indices) total += values[index];
    return total / indices.length;
  }

  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function validateStepInputs(
  graph: EngineGraph,
  externalDrive: Float32Array,
  modulation: ModulationSnapshot,
): void {
  if (externalDrive.length !== graph.nodeCount) {
    throw new RangeError(
      `externalDrive length ${externalDrive.length} does not match nodeCount ${graph.nodeCount}`,
    );
  }
  if (
    modulation.stimulation.length !== graph.nodeCount ||
    modulation.inhibition.length !== graph.nodeCount
  ) {
    throw new RangeError('neuron modulation arrays must match nodeCount');
  }
  if (modulation.connectionGain.length !== graph.weight.length) {
    throw new RangeError('connectionGain length must match edge count');
  }

  for (let index = 0; index < graph.nodeCount; index += 1) {
    if (
      !Number.isFinite(externalDrive[index]) ||
      !Number.isFinite(modulation.stimulation[index]) ||
      !Number.isFinite(modulation.inhibition[index])
    ) {
      throw new RangeError('neural drive and modulation values must be finite');
    }
  }
  for (const gain of modulation.connectionGain) {
    if (!Number.isFinite(gain) || gain < 0 || gain > 2) {
      throw new RangeError('connection gain must stay within 0..2');
    }
  }
}

export class BrainEngine {
  private readonly graph: EngineGraph;
  private readonly activationState: Float32Array;
  private readonly incoming: Float32Array;
  private readonly random: SeededRandom;

  constructor(graph: EngineGraph, seed: number) {
    validateGraph(graph);
    this.graph = copyGraph(graph);
    this.activationState = new Float32Array(graph.nodeCount);
    this.incoming = new Float32Array(graph.nodeCount);
    this.random = new SeededRandom(seed);
  }

  get activation(): Float32Array {
    return this.activationState.slice();
  }

  reset(): void {
    this.activationState.fill(0);
    this.incoming.fill(0);
    this.random.reset();
  }

  step(
    dtMs: number,
    externalDrive: Float32Array,
    modulation: ModulationSnapshot,
  ): BrainStepResult {
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      throw new RangeError('dtMs must be a finite non-negative value');
    }
    validateStepInputs(this.graph, externalDrive, modulation);

    this.incoming.fill(0);

    for (let edge = 0; edge < this.graph.weight.length; edge += 1) {
      const source = this.graph.source[edge];
      const target = this.graph.target[edge];
      const propagated =
        this.activationState[source] *
        normalizeWeight(this.graph.weight[edge]) *
        modulation.connectionGain[edge];
      this.incoming[target] += propagated;
    }

    const alpha = clamp(dtMs / 80, 0, 1);
    for (let index = 0; index < this.graph.nodeCount; index += 1) {
      this.incoming[index] +=
        externalDrive[index] +
        modulation.stimulation[index] * 0.75 -
        modulation.inhibition[index] * 0.75;

      const targetActivation = sigmoid(this.incoming[index] - 0.5);
      const noise = (this.random.next() - 0.5) * 0.01;
      this.activationState[index] = clamp01(
        this.activationState[index] +
          (targetActivation - this.activationState[index]) * alpha +
          noise,
      );
    }

    const behavior = this.readBehavior();
    return {
      activation: this.activationState.slice(),
      behavior,
    };
  }

  private readBehavior(): BehaviorState {
    const turnLeft = mean(this.activationState, this.graph.turnLeftPorts);
    const turnRight = mean(this.activationState, this.graph.turnRightPorts);
    const forward = clamp01(
      mean(this.activationState, this.graph.forwardPorts),
    );

    return {
      turn: clamp(turnRight - turnLeft, -1, 1),
      forward,
      dwell: clamp01(1 - forward),
      arousal: clamp01(mean(this.activationState)),
    };
  }
}
