import { describe, expect, it } from 'vitest';
import { BrainLayout } from '../../src/brain/BrainLayout';
import { CircuitGraph } from '../../src/brain/CircuitGraph';
import type { CircuitMetadata } from '../../src/brain/CircuitTypes';

function makeGraph(): CircuitGraph {
  const metadata: CircuitMetadata = {
    schema: 1,
    dataset: 'male-cns:v1.0',
    circuit: 'dna-steering-v1',
    neurons: [
      { bodyId: '100', type: 'interior', instance: null, somaSide: 'M', neurotransmitter: null, inputPort: false, descendingSeed: false },
      { bodyId: '30', type: 'interior', instance: null, somaSide: 'M', neurotransmitter: null, inputPort: false, descendingSeed: false },
      { bodyId: '2', type: 'interior', instance: null, somaSide: 'M', neurotransmitter: null, inputPort: false, descendingSeed: false },
      { bodyId: '900', type: 'input', instance: null, somaSide: 'L', neurotransmitter: null, inputPort: true, descendingSeed: false },
      { bodyId: '4', type: 'interior', instance: null, somaSide: 'M', neurotransmitter: null, inputPort: false, descendingSeed: false },
      { bodyId: '5', type: 'interior', instance: null, somaSide: 'M', neurotransmitter: null, inputPort: false, descendingSeed: false },
      { bodyId: '800', type: 'descending', instance: null, somaSide: 'R', neurotransmitter: null, inputPort: false, descendingSeed: true },
      { bodyId: '700', type: 'behavior-port', instance: null, somaSide: 'L', neurotransmitter: null, inputPort: false, descendingSeed: false },
    ],
    behaviorPorts: {
      turnLeft: ['700'],
      turnRight: ['800'],
      forward: [],
    },
  };
  return new CircuitGraph(metadata, []);
}

function xyz(positions: Float32Array, index: number): [number, number, number] {
  return [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
}

describe('BrainLayout', () => {
  it('places input ports left and descending/behavior ports right', () => {
    const graph = makeGraph();
    const positions = BrainLayout.compute(graph);

    expect(xyz(positions, graph.indexByBodyId.get('900')!)[0]).toBe(-1);
    expect(xyz(positions, graph.indexByBodyId.get('800')!)[0]).toBe(1);
    expect(xyz(positions, graph.indexByBodyId.get('700')!)[0]).toBe(1);
  });

  it('assigns interior columns by numeric body ID order', () => {
    const graph = makeGraph();
    const positions = BrainLayout.compute(graph);

    expect(xyz(positions, graph.indexByBodyId.get('2')!)[0]).toBeCloseTo(-0.6);
    expect(xyz(positions, graph.indexByBodyId.get('4')!)[0]).toBeCloseTo(-0.2);
    expect(xyz(positions, graph.indexByBodyId.get('5')!)[0]).toBeCloseTo(0.2);
    expect(xyz(positions, graph.indexByBodyId.get('30')!)[0]).toBeCloseTo(0.6);
    expect(xyz(positions, graph.indexByBodyId.get('100')!)[0]).toBeCloseTo(-0.6);
  });

  it('spreads nodes vertically within each band and keeps z offsets bounded', () => {
    const graph = makeGraph();
    const positions = BrainLayout.compute(graph);

    for (let index = 0; index < graph.metadata.neurons.length; index += 1) {
      const [, y, z] = xyz(positions, index);
      expect(y).toBeGreaterThanOrEqual(-0.900001);
      expect(y).toBeLessThanOrEqual(0.900001);
      expect(Math.abs(z)).toBeLessThanOrEqual(0.05);
    }
  });

  it('returns byte-for-byte equal positions for the same graph', () => {
    const graph = makeGraph();
    expect([...BrainLayout.compute(graph)]).toEqual([...BrainLayout.compute(graph)]);
  });
});
