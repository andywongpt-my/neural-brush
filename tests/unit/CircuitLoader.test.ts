import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CircuitMetadata } from '../../src/brain/CircuitTypes';
import { CircuitLoader } from '../../src/brain/CircuitLoader';
import { packCircuit, type RawCircuit } from '../../tools/malecns-export/pack';
import fixture from '../fixtures/raw-circuit.fixture.json';

function validFixture() {
  return packCircuit(structuredClone(fixture) as RawCircuit);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('CircuitLoader.load', () => {
  it('loads metadata and binary from the same normalized base URL', async () => {
    const { metadata, binary } = validFixture();
    const requested: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.endsWith('/metadata.json')) {
        return new Response(JSON.stringify(metadata), { status: 200 });
      }
      if (url.endsWith('/circuit.bin')) {
        return new Response(toArrayBuffer(binary), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    const graph = await CircuitLoader.load('/assets/male-cns-v1');

    expect(requested).toEqual([
      '/assets/male-cns-v1/metadata.json',
      '/assets/male-cns-v1/circuit.bin',
    ]);
    expect(graph.sourceWeights).toEqual([12, 7]);
  });

  it('names metadata.json and status when metadata loading fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));

    await expect(CircuitLoader.load('/missing/')).rejects.toThrow(
      'metadata.json (HTTP 404)',
    );
  });

  it('names circuit.bin and status when binary loading fails', async () => {
    const { metadata } = validFixture();
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/metadata.json')) {
        return new Response(JSON.stringify(metadata), { status: 200 });
      }
      return new Response('', { status: 503 });
    });

    await expect(CircuitLoader.load('/assets/')).rejects.toThrow(
      'circuit.bin (HTTP 503)',
    );
  });

  it('rejects unexpected dataset metadata before decoding', async () => {
    const { metadata } = validFixture();
    const invalid = { ...metadata, dataset: 'male-cns:v2.0' } as unknown as CircuitMetadata;
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify(invalid), { status: 200 }),
    );

    await expect(CircuitLoader.load('/assets/')).rejects.toThrow(
      'Expected circuit dataset male-cns:v1.0',
    );
  });

  it('rejects unexpected circuit metadata before decoding', async () => {
    const { metadata } = validFixture();
    const invalid = { ...metadata, circuit: 'other-circuit' } as unknown as CircuitMetadata;
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify(invalid), { status: 200 }),
    );

    await expect(CircuitLoader.load('/assets/')).rejects.toThrow(
      'Expected circuit id dna-steering-v1',
    );
  });
});
