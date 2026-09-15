import type { CircuitGraph } from './CircuitGraph';
import type { EngineGraph } from './BrainRuntimeTypes';

function mapBodyIds(
  graph: CircuitGraph,
  label: string,
  bodyIds: readonly string[],
): Uint32Array {
  return Uint32Array.from(
    bodyIds.map((bodyId) => {
      const index = graph.indexByBodyId.get(bodyId);
      if (index === undefined) {
        throw new Error(`${label} references unknown body ID ${bodyId}`);
      }
      return index;
    }),
  );
}

export function toEngineGraph(graph: CircuitGraph): EngineGraph {
  const nodeCount = graph.metadata.neurons.length;
  const edgeCount = graph.edges.length;
  const source = new Uint32Array(edgeCount);
  const target = new Uint32Array(edgeCount);
  const weight = new Uint32Array(edgeCount);

  graph.edges.forEach((edge, index) => {
    if (
      edge.sourceIndex < 0 ||
      edge.sourceIndex >= nodeCount ||
      edge.targetIndex < 0 ||
      edge.targetIndex >= nodeCount
    ) {
      throw new Error(
        `Circuit edge ${edge.sourceIndex}->${edge.targetIndex} is outside nodeCount ${nodeCount}`,
      );
    }
    if (!Number.isInteger(edge.weight) || edge.weight <= 0) {
      throw new Error(`Circuit edge weight must be a positive integer at edge ${index}`);
    }
    source[index] = edge.sourceIndex;
    target[index] = edge.targetIndex;
    weight[index] = edge.weight;
  });

  const inputPorts = Uint32Array.from(
    graph.metadata.neurons.flatMap((neuron, index) =>
      neuron.inputPort ? [index] : [],
    ),
  );

  return {
    nodeCount,
    source,
    target,
    weight,
    inputPorts,
    turnLeftPorts: mapBodyIds(
      graph,
      'turnLeft',
      graph.metadata.behaviorPorts.turnLeft,
    ),
    turnRightPorts: mapBodyIds(
      graph,
      'turnRight',
      graph.metadata.behaviorPorts.turnRight,
    ),
    forwardPorts: mapBodyIds(
      graph,
      'forward',
      graph.metadata.behaviorPorts.forward,
    ),
  };
}
