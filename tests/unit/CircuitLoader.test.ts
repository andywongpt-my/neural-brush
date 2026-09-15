import { describe, expect, it } from 'vitest';
import { CircuitLoader } from '../../src/brain/CircuitLoader';
import { packCircuit, type RawCircuit } from '../../tools/malecns-export/pack';
import fixture from '../fixtures/raw-circuit.fixture.json';

function validFixture() {
  return packCircuit(structuredClone(fixture) as RawCircuit);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

describe('CircuitLoader.decode', () => {
  it('rejects a bad magic header', () => {
    const { metadata, binary } = validFixture();
    const mutated = Uint8Array.from(binary);
    mutated.set(new TextEncoder().encode('XXXX'), 0);

    expect(() => CircuitLoader.decode(metadata, mutated.buffer)).toThrow('magic');
  });

  it('rejects an edge count that does not match byte length', () => {
    const { metadata, binary } = validFixture();
    const mutated = Uint8Array.from(binary);
    new DataView(mutated.buffer).setUint32(8, 99, true);

    expect(() => CircuitLoader.decode(metadata, mutated.buffer)).toThrow('byte length');
  });

  it('rejects node indices outside metadata.neurons', () => {
    const { metadata, binary } = validFixture();
    const mutated = Uint8Array.from(binary);
    new DataView(mutated.buffer).setUint32(12, metadata.neurons.length, true);

    expect(() => CircuitLoader.decode(metadata, mutated.buffer)).toThrow('node index');
  });

  it('decodes a valid fixture and preserves immutable source weights', () => {
    const { metadata, binary } = validFixture();
    const graph = CircuitLoader.decode(metadata, toArrayBuffer(binary));

    expect(graph.sourceWeights).toEqual([12, 7]);
    expect(graph.edges.map((edge) => [edge.sourceIndex, edge.targetIndex])).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(graph.indexByBodyId.get('100')).toBe(0);
    expect(graph.indexByBodyId.get('300')).toBe(2);
    expect(Object.isFrozen(graph.edges)).toBe(true);
    expect(Object.isFrozen(graph.sourceWeights)).toBe(true);
    expect(Object.isFrozen(graph.metadata.neurons)).toBe(true);
  });
});
