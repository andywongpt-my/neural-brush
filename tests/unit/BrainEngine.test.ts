import { describe, expect, it } from 'vitest';
import { BrainEngine } from '../../src/brain/BrainEngine';
import type {
  EngineGraph,
  ModulationSnapshot,
} from '../../src/brain/BrainRuntimeTypes';

function makeGraph(): EngineGraph {
  return {
    nodeCount: 4,
    source: new Uint32Array([0, 0]),
    target: new Uint32Array([1, 2]),
    weight: new Uint32Array([20, 20]),
    inputPorts: new Uint32Array([0, 1, 2, 3]),
    turnLeftPorts: new Uint32Array([1]),
    turnRightPorts: new Uint32Array([2]),
    forwardPorts: new Uint32Array([3]),
  };
}

function neutralModulation(graph: EngineGraph): ModulationSnapshot {
  const edgeCount = graph.weight.length;
  const gain = new Float32Array(edgeCount);
  gain.fill(1);
  return {
    stimulation: new Float32Array(graph.nodeCount),
    inhibition: new Float32Array(graph.nodeCount),
    connectionGain: gain,
  };
}

function bytes(values: Float32Array): number[] {
  return [...new Uint8Array(values.buffer.slice(0))];
}

describe('BrainEngine', () => {
  it('produces byte-for-byte equal activations with the same seed and inputs', () => {
    const graph = makeGraph();
    const modulation = neutralModulation(graph);
    const drive = new Float32Array([0.8, 0.2, 0.6, 0.4]);
    const a = new BrainEngine(graph, 12345);
    const b = new BrainEngine(graph, 12345);

    for (let step = 0; step < 20; step += 1) {
      const left = a.step(1000 / 60, drive, modulation);
      const right = b.step(1000 / 60, drive, modulation);
      expect(bytes(left.activation)).toEqual(bytes(right.activation));
      expect(left.behavior).toEqual(right.behavior);
    }
  });

  it('connection gain zero prevents that edge from propagating', () => {
    const graph = makeGraph();
    const drive = new Float32Array([1, 0, 0, 0]);
    const open = neutralModulation(graph);
    const blocked = neutralModulation(graph);
    blocked.connectionGain[0] = 0;
    const withEdge = new BrainEngine(graph, 7);
    const withoutEdge = new BrainEngine(graph, 7);

    withEdge.step(80, drive, open);
    withoutEdge.step(80, drive, blocked);
    const propagated = withEdge.step(80, new Float32Array(4), open);
    const isolated = withoutEdge.step(80, new Float32Array(4), blocked);

    expect(propagated.activation[1]).toBeGreaterThan(isolated.activation[1]);
  });

  it('positive right activity yields positive turn', () => {
    const graph = makeGraph();
    const engine = new BrainEngine(graph, 99);
    const result = engine.step(
      80,
      new Float32Array([0, 0, 2, 0]),
      neutralModulation(graph),
    );

    expect(result.behavior.turn).toBeGreaterThan(0);
  });

  it('dwell is exactly clamp01(1 - forward)', () => {
    const graph = makeGraph();
    const engine = new BrainEngine(graph, 100);
    const result = engine.step(
      80,
      new Float32Array([0, 0, 0, 1]),
      neutralModulation(graph),
    );

    expect(result.behavior.dwell).toBe(1 - result.behavior.forward);
  });

  it('does not mutate source weights after repeated modulated steps', () => {
    const graph = makeGraph();
    const before = [...graph.weight];
    const modulation = neutralModulation(graph);
    modulation.connectionGain[0] = 0.25;
    modulation.connectionGain[1] = 2;
    const engine = new BrainEngine(graph, 123);

    for (let step = 0; step < 100; step += 1) {
      engine.step(1000 / 60, new Float32Array([0.4, 0.1, 0.2, 0.3]), modulation);
    }

    expect([...graph.weight]).toEqual(before);
  });

  it('requires source-verified left/right steering ports but allows forward to be absent', () => {
    const graph = makeGraph();
    expect(
      () => new BrainEngine({ ...graph, turnLeftPorts: new Uint32Array() }, 1),
    ).toThrow('turnLeftPorts');
    expect(
      () => new BrainEngine({ ...graph, turnRightPorts: new Uint32Array() }, 1),
    ).toThrow('turnRightPorts');

    const noForward = { ...graph, forwardPorts: new Uint32Array() };
    const result = new BrainEngine(noForward, 1).step(
      80,
      new Float32Array([0, 0, 0, 1]),
      neutralModulation(noForward),
    );
    expect(result.behavior.forward).toBe(0);
    expect(result.behavior.dwell).toBe(1);
  });
});
