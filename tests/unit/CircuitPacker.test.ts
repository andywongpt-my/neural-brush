import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAssetBundle,
  packCircuit,
  resolveGeneratedAt,
  runPacker,
  type RawCircuit,
} from '../../tools/malecns-export/pack';
import { sha256Hex } from '../../tools/malecns-export/hash';
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

  it('keeps DNa steering ports lateralized without inventing a forward-speed readout', () => {
    const { metadata } = packCircuit(fixture);

    expect(metadata.behaviorPorts.turnLeft).toEqual(['200']);
    expect(metadata.behaviorPorts.turnRight).toEqual(['300']);
    expect(metadata.behaviorPorts.forward).toEqual([]);
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

describe('buildAssetBundle', () => {
  it('serializes deterministic metadata and manifest hashes', () => {
    const raw = cloneFixture();
    const rawText = JSON.stringify(raw);
    const generatedAt = '2026-09-15T00:00:00.000Z';
    const bundle = buildAssetBundle(raw, rawText, generatedAt);

    expect(bundle.manifest.generatedAt).toBe(generatedAt);
    expect(bundle.manifest.rawSha256).toBe(sha256Hex(rawText));
    expect(bundle.manifest.binarySha256).toBe(sha256Hex(bundle.binary));
    expect(JSON.parse(bundle.metadataText).neurons.map((neuron: { bodyId: string }) => neuron.bodyId)).toEqual([
      '100',
      '200',
      '300',
    ]);
    expect(JSON.parse(bundle.manifestText)).toEqual(bundle.manifest);
  });

  it('rejects a browser payload larger than 10 MiB', () => {
    const raw = cloneFixture();
    raw.neurons[0].type = 'x'.repeat(10 * 1024 * 1024);
    const rawText = JSON.stringify(raw);

    expect(() =>
      buildAssetBundle(raw, rawText, '2026-09-15T00:00:00.000Z'),
    ).toThrow('10 MiB');
  });
});

describe('generation timestamp', () => {
  it('uses an explicit workflow timestamp for reproducible retries', () => {
    expect(resolveGeneratedAt('2026-09-15T11:18:03+00:00')).toBe(
      '2026-09-15T11:18:03+00:00',
    );
  });
});

describe('runPacker', () => {
  it('writes circuit, metadata, and manifest assets from a raw JSON file', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'neural-brush-pack-'));
    try {
      runPacker(
        'tests/fixtures/raw-circuit.fixture.json',
        outputDir,
        '2026-09-15T00:00:00.000Z',
      );

      expect(new TextDecoder().decode(readFileSync(join(outputDir, 'circuit.bin')).subarray(0, 4))).toBe('NBC1');
      expect(JSON.parse(readFileSync(join(outputDir, 'metadata.json'), 'utf8')).neurons).toHaveLength(3);
      expect(JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf8')).generatedAt).toBe(
        '2026-09-15T00:00:00.000Z',
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
