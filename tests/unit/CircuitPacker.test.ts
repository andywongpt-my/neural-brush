import { describe, expect, it } from 'vitest';
import { packCircuit, type RawCircuit } from '../../tools/malecns-export/pack';
import fixture from '../fixtures/raw-circuit.fixture.json';

function cloneFixture(): RawCircuit {
  return structuredClone(fixture) as RawCircuit;
}

describe('packCircuit', () => {
  it('writes NBC1 and schema version 1', () => {
    const { binary } = packCircuit(fixture);

    expect(new TextDecoder().decode(binary.slice(0, 4))).toBe('NBC1');
    expect(new DataView(binary.buffer).getUint16(4, true)).toBe(1);
  });

  it('sorts neurons numerically and writes deterministic edge records', () => {
    const { metadata, binary } = packCircuit(fixture);
    const view = new DataView(binary.buffer);

    expect(metadata.neurons.map((neuron) => neuron.bodyId)).toEqual(['100', '200', '300']);
    expect(view.getUint32(8, true)).toBe(2);
    expect([
      view.getUint32(12, true),
      view.getUint32(16, true),
      view.getUint32(20, true),
    ]).toEqual([0, 1, 12]);
    expect([
      view.getUint32(24, true),
      view.getUint32(28, true),
      view.getUint32(32, true),
    ]).toEqual([1, 2, 7]);
  });

  it('rejects an edge endpoint outside the selected neuron set', () => {
    const raw = cloneFixture();
    raw.edges[0] = { source: '999', target: '300', weight: 7 };

    expect(() => packCircuit(raw)).toThrow('Edge endpoint is not present');
  });

  it('rejects duplicate directed edges', () => {
    const raw = cloneFixture();
    raw.edges.push({ ...raw.edges[0] });

    expect(() => packCircuit(raw)).toThrow('Duplicate directed edge');
  });

  it.each([0, -1, 1.5])('rejects invalid edge weight %s', (weight) => {
    const raw = cloneFixture();
    raw.edges[0] = { ...raw.edges[0], weight };

    expect(() => packCircuit(raw)).toThrow('Edge weight must be a positive integer');
  });
});
