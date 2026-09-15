import type { CircuitMetadata, CircuitNeuron } from './CircuitTypes';

export interface CircuitEdge {
  readonly sourceIndex: number;
  readonly targetIndex: number;
  readonly weight: number;
}

export interface ReadonlyBehaviorPorts {
  readonly turnLeft: readonly string[];
  readonly turnRight: readonly string[];
  readonly forward: readonly string[];
}

export interface ReadonlyCircuitMetadata {
  readonly schema: CircuitMetadata['schema'];
  readonly dataset: CircuitMetadata['dataset'];
  readonly circuit: CircuitMetadata['circuit'];
  readonly neurons: readonly Readonly<CircuitNeuron>[];
  readonly behaviorPorts: ReadonlyBehaviorPorts;
}

function freezeMetadata(metadata: CircuitMetadata): ReadonlyCircuitMetadata {
  const neurons = Object.freeze(
    metadata.neurons.map((neuron) => Object.freeze({ ...neuron })),
  );
  const behaviorPorts = Object.freeze({
    turnLeft: Object.freeze([...metadata.behaviorPorts.turnLeft]),
    turnRight: Object.freeze([...metadata.behaviorPorts.turnRight]),
    forward: Object.freeze([...metadata.behaviorPorts.forward]),
  });

  return Object.freeze({
    schema: metadata.schema,
    dataset: metadata.dataset,
    circuit: metadata.circuit,
    neurons,
    behaviorPorts,
  });
}

export class CircuitGraph {
  readonly metadata: ReadonlyCircuitMetadata;
  readonly edges: readonly CircuitEdge[];
  readonly sourceWeights: readonly number[];
  readonly indexByBodyId: ReadonlyMap<string, number>;

  constructor(metadata: CircuitMetadata, edges: readonly CircuitEdge[]) {
    this.metadata = freezeMetadata(metadata);
    this.edges = Object.freeze(
      edges.map((edge) => Object.freeze({ ...edge })),
    );
    this.sourceWeights = Object.freeze(this.edges.map((edge) => edge.weight));

    const indexByBodyId = new Map<string, number>();
    this.metadata.neurons.forEach((neuron, index) => {
      if (indexByBodyId.has(neuron.bodyId)) {
        throw new Error(`Duplicate metadata body ID: ${neuron.bodyId}`);
      }
      indexByBodyId.set(neuron.bodyId, index);
    });
    this.indexByBodyId = indexByBodyId;
  }
}
