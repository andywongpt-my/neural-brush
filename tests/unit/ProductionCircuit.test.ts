import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CircuitLoader } from '../../src/brain/CircuitLoader';
import type { CircuitMetadata } from '../../src/brain/CircuitTypes';
import { sha256Hex } from '../../tools/malecns-export/hash';

const DATA_DIR = resolve('public/data/male-cns-v1');

interface ProductionManifest {
  schema: number;
  dataset: string;
  circuit: string;
  source: string;
  neuronCount: number;
  edgeCount: number;
  rawSha256: string;
  binarySha256: string;
}

describe('committed MaleCNS production circuit', () => {
  it('matches the verified v1 snapshot and decodes without mutation', () => {
    const metadata = JSON.parse(
      readFileSync(resolve(DATA_DIR, 'metadata.json'), 'utf8'),
    ) as CircuitMetadata;
    const manifest = JSON.parse(
      readFileSync(resolve(DATA_DIR, 'manifest.json'), 'utf8'),
    ) as ProductionManifest;
    const binary = readFileSync(resolve(DATA_DIR, 'circuit.bin'));

    expect(manifest.dataset).toBe('male-cns:v1.0');
    expect(manifest.circuit).toBe('dna-steering-v1');
    expect(manifest.source).toBe('male-cns-public-bulk:v1.0');
    expect(manifest.neuronCount).toBe(151);
    expect(manifest.edgeCount).toBe(3901);
    expect(metadata.neurons).toHaveLength(manifest.neuronCount);
    expect(sha256Hex(binary)).toBe(manifest.binarySha256);

    const graph = CircuitLoader.decode(
      metadata,
      Uint8Array.from(binary).buffer,
    );
    expect(graph.edges).toHaveLength(manifest.edgeCount);
    expect(graph.sourceWeights).toHaveLength(manifest.edgeCount);

    expect(
      metadata.neurons
        .filter((neuron) => neuron.descendingSeed)
        .map((neuron) => neuron.bodyId),
    ).toEqual(['10360', '10442', '10760', '523769']);
    expect(metadata.behaviorPorts.turnLeft).toEqual(['10442', '523769']);
    expect(metadata.behaviorPorts.turnRight).toEqual(['10360', '10760']);
    expect(metadata.behaviorPorts.forward).toEqual([]);

    const totalBytes = ['circuit.bin', 'metadata.json', 'manifest.json']
      .map((name) => statSync(resolve(DATA_DIR, name)).size)
      .reduce((sum, size) => sum + size, 0);
    expect(totalBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
