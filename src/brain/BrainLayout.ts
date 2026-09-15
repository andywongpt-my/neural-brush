import type { CircuitGraph } from './CircuitGraph';

const INTERIOR_COLUMNS = [-0.6, -0.2, 0.2, 0.6] as const;
const Y_MIN = -0.9;
const Y_MAX = 0.9;

function bodyIdNumber(bodyId: string): bigint {
  if (!/^\d+$/.test(bodyId)) {
    throw new Error(`BrainLayout requires decimal body IDs, got ${bodyId}`);
  }
  return BigInt(bodyId);
}

function sortByBodyId(graph: CircuitGraph, indices: number[]): number[] {
  return [...indices].sort((a, b) => {
    const aa = bodyIdNumber(graph.metadata.neurons[a].bodyId);
    const bb = bodyIdNumber(graph.metadata.neurons[b].bodyId);
    return aa < bb ? -1 : aa > bb ? 1 : 0;
  });
}

function spreadY(count: number, ordinal: number): number {
  if (count <= 1) return 0;
  return Y_MIN + ((Y_MAX - Y_MIN) * ordinal) / (count - 1);
}

function setPosition(
  positions: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
): void {
  const offset = index * 3;
  positions[offset] = x;
  positions[offset + 1] = y;
  positions[offset + 2] = z;
}

export class BrainLayout {
  static compute(graph: CircuitGraph): Float32Array {
    const positions = new Float32Array(graph.metadata.neurons.length * 3);
    const behaviorBodies = new Set<string>([
      ...graph.metadata.behaviorPorts.turnLeft,
      ...graph.metadata.behaviorPorts.turnRight,
      ...graph.metadata.behaviorPorts.forward,
    ]);

    const input: number[] = [];
    const output: number[] = [];
    const interior: number[] = [];

    graph.metadata.neurons.forEach((neuron, index) => {
      const isOutput = neuron.descendingSeed || behaviorBodies.has(neuron.bodyId);
      if (isOutput) output.push(index);
      else if (neuron.inputPort) input.push(index);
      else interior.push(index);
    });

    const sortedInput = sortByBodyId(graph, input);
    sortedInput.forEach((index, ordinal) => {
      setPosition(positions, index, -1, spreadY(sortedInput.length, ordinal), -0.02);
    });

    const sortedOutput = sortByBodyId(graph, output);
    sortedOutput.forEach((index, ordinal) => {
      setPosition(positions, index, 1, spreadY(sortedOutput.length, ordinal), 0.02);
    });

    const sortedInterior = sortByBodyId(graph, interior);
    const columnGroups: number[][] = INTERIOR_COLUMNS.map(() => []);
    sortedInterior.forEach((index, ordinal) => {
      columnGroups[ordinal % INTERIOR_COLUMNS.length].push(index);
    });
    columnGroups.forEach((group, column) => {
      group.forEach((index, ordinal) => {
        setPosition(
          positions,
          index,
          INTERIOR_COLUMNS[column],
          spreadY(group.length, ordinal),
          (column - 1.5) * 0.006,
        );
      });
    });

    return positions;
  }
}
