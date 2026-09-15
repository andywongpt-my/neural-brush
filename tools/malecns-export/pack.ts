import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CIRCUIT_SCHEMA_VERSION,
  DATASET_ID,
  SOURCE_ID,
  type CircuitManifest,
  type CircuitMetadata,
  type CircuitNeuron,
  type SomaSide,
} from '../../src/brain/CircuitTypes';
import { sha256Hex } from './hash';

const CIRCUIT_ID = 'dna-steering-v1' as const;
const MAGIC = 'NBC1';
const HEADER_BYTES = 12;
const EDGE_RECORD_BYTES = 12;
const MAX_BROWSER_PAYLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_INPUT_PATH = resolve('tools/malecns-export/out/raw-circuit.json');
const DEFAULT_OUTPUT_DIR = resolve('public/data/male-cns-v1');

interface RawNeuron {
  bodyId: string;
  type: string | null;
  instance: string | null;
  somaSide: string | null;
  neurotransmitter: string | null;
  inputPort: boolean;
  descendingSeed: boolean;
}

interface RawEdge {
  source: string;
  target: string;
  weight: number;
}

interface RawBehaviorPorts {
  turnLeft: string[];
  turnRight: string[];
  forward: string[];
}

export interface RawCircuit {
  dataset: string;
  circuit: string;
  neurons: RawNeuron[];
  edges: RawEdge[];
  behaviorPorts: RawBehaviorPorts;
}

export type ManifestBase = Omit<
  CircuitManifest,
  'generatedAt' | 'rawSha256' | 'binarySha256'
>;

export interface PackedCircuit {
  metadata: CircuitMetadata;
  binary: Uint8Array;
  manifestBase: ManifestBase;
}

export interface AssetBundle {
  metadataText: string;
  manifest: CircuitManifest;
  manifestText: string;
  binary: Uint8Array;
}

function assertBodyId(bodyId: string): void {
  if (!/^\d+$/.test(bodyId)) {
    throw new Error(`Invalid body ID: ${bodyId}`);
  }
}

function compareBodyIds(left: string, right: string): number {
  const a = BigInt(left);
  const b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeSomaSide(value: string | null): SomaSide {
  if (value === 'L' || value === 'R' || value === 'M') return value;
  return 'unknown';
}

function copyNeuron(raw: RawNeuron): CircuitNeuron {
  assertBodyId(raw.bodyId);
  return {
    bodyId: raw.bodyId,
    type: raw.type,
    instance: raw.instance,
    somaSide: normalizeSomaSide(raw.somaSide),
    neurotransmitter: raw.neurotransmitter,
    inputPort: raw.inputPort,
    descendingSeed: raw.descendingSeed,
  };
}

function sortedPortIds(ids: string[], validIds: ReadonlySet<string>): string[] {
  const result = [...ids];
  for (const bodyId of result) {
    assertBodyId(bodyId);
    if (!validIds.has(bodyId)) {
      throw new Error(`Behavior port references unknown body ID: ${bodyId}`);
    }
  }
  return result.sort(compareBodyIds);
}

export function packCircuit(raw: RawCircuit): PackedCircuit {
  if (raw.dataset !== DATASET_ID) {
    throw new Error(`Expected dataset ${DATASET_ID}, got ${raw.dataset}`);
  }
  if (raw.circuit !== CIRCUIT_ID) {
    throw new Error(`Expected circuit ${CIRCUIT_ID}, got ${raw.circuit}`);
  }

  const neurons = raw.neurons.map(copyNeuron).sort((a, b) =>
    compareBodyIds(a.bodyId, b.bodyId),
  );
  const indexByBodyId = new Map<string, number>();
  neurons.forEach((neuron, index) => {
    if (indexByBodyId.has(neuron.bodyId)) {
      throw new Error(`Duplicate neuron body ID: ${neuron.bodyId}`);
    }
    indexByBodyId.set(neuron.bodyId, index);
  });

  const indexedEdges = raw.edges.map((edge) => {
    assertBodyId(edge.source);
    assertBodyId(edge.target);
    const sourceIndex = indexByBodyId.get(edge.source);
    const targetIndex = indexByBodyId.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) {
      throw new Error(`Edge endpoint is not present in neuron metadata: ${edge.source}->${edge.target}`);
    }
    if (!Number.isInteger(edge.weight) || edge.weight <= 0) {
      throw new Error(`Edge weight must be a positive integer: ${edge.source}->${edge.target}`);
    }
    if (edge.weight > 0xffff_ffff) {
      throw new Error(`Edge weight exceeds uint32 range: ${edge.source}->${edge.target}`);
    }
    return { sourceIndex, targetIndex, weight: edge.weight };
  });

  indexedEdges.sort(
    (a, b) => a.sourceIndex - b.sourceIndex || a.targetIndex - b.targetIndex,
  );
  for (let index = 1; index < indexedEdges.length; index += 1) {
    const previous = indexedEdges[index - 1];
    const current = indexedEdges[index];
    if (
      previous.sourceIndex === current.sourceIndex &&
      previous.targetIndex === current.targetIndex
    ) {
      throw new Error(
        `Duplicate directed edge: ${previous.sourceIndex}->${previous.targetIndex}`,
      );
    }
  }

  const binary = new Uint8Array(HEADER_BYTES + indexedEdges.length * EDGE_RECORD_BYTES);
  binary.set(new TextEncoder().encode(MAGIC), 0);
  const view = new DataView(binary.buffer);
  view.setUint16(4, CIRCUIT_SCHEMA_VERSION, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, indexedEdges.length, true);

  indexedEdges.forEach((edge, index) => {
    const offset = HEADER_BYTES + index * EDGE_RECORD_BYTES;
    view.setUint32(offset, edge.sourceIndex, true);
    view.setUint32(offset + 4, edge.targetIndex, true);
    view.setUint32(offset + 8, edge.weight, true);
  });

  const validIds = new Set(neurons.map((neuron) => neuron.bodyId));
  const metadata: CircuitMetadata = {
    schema: CIRCUIT_SCHEMA_VERSION,
    dataset: DATASET_ID,
    circuit: CIRCUIT_ID,
    neurons,
    behaviorPorts: {
      turnLeft: sortedPortIds(raw.behaviorPorts.turnLeft, validIds),
      turnRight: sortedPortIds(raw.behaviorPorts.turnRight, validIds),
      forward: sortedPortIds(raw.behaviorPorts.forward, validIds),
    },
  };

  const manifestBase: ManifestBase = {
    schema: CIRCUIT_SCHEMA_VERSION,
    dataset: DATASET_ID,
    circuit: CIRCUIT_ID,
    source: SOURCE_ID,
    seedSelectors: ['DNa01', 'DNa02'],
    neuronCount: neurons.length,
    edgeCount: indexedEdges.length,
  };

  return { metadata, binary, manifestBase };
}

export function buildAssetBundle(
  raw: RawCircuit,
  rawText: string,
  generatedAt: string,
): AssetBundle {
  const { metadata, binary, manifestBase } = packCircuit(raw);
  const metadataText = `${JSON.stringify(metadata, null, 2)}\n`;
  const manifest: CircuitManifest = {
    ...manifestBase,
    generatedAt,
    rawSha256: sha256Hex(rawText),
    binarySha256: sha256Hex(binary),
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const totalBytes =
    new TextEncoder().encode(metadataText).byteLength +
    new TextEncoder().encode(manifestText).byteLength +
    binary.byteLength;
  if (totalBytes > MAX_BROWSER_PAYLOAD_BYTES) {
    throw new Error(
      `Packed browser payload exceeds 10 MiB: ${totalBytes} bytes`,
    );
  }
  return { metadataText, manifest, manifestText, binary };
}

export function resolveGeneratedAt(
  explicit = process.env.NEURAL_BRUSH_GENERATED_AT,
): string {
  const value = explicit?.trim();
  return value && value.length > 0 ? value : new Date().toISOString();
}

export function runPacker(
  inputPath = DEFAULT_INPUT_PATH,
  outputDir = DEFAULT_OUTPUT_DIR,
  generatedAt = resolveGeneratedAt(),
): AssetBundle {
  const rawText = readFileSync(inputPath, 'utf8');
  const raw = JSON.parse(rawText) as RawCircuit;
  const bundle = buildAssetBundle(raw, rawText, generatedAt);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'metadata.json'), bundle.metadataText);
  writeFileSync(resolve(outputDir, 'manifest.json'), bundle.manifestText);
  writeFileSync(resolve(outputDir, 'circuit.bin'), bundle.binary);
  return bundle;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const bundle = runPacker();
  console.log(
    `Packed ${bundle.manifest.neuronCount} neurons and ${bundle.manifest.edgeCount} edges to ${DEFAULT_OUTPUT_DIR}`,
  );
}
