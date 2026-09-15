import { CIRCUIT_SCHEMA_VERSION, DATASET_ID, type CircuitMetadata } from './CircuitTypes';
import { CircuitGraph, type CircuitEdge } from './CircuitGraph';

const CIRCUIT_ID = 'dna-steering-v1' as const;
const MAGIC = 'NBC1';
const HEADER_BYTES = 12;
const EDGE_RECORD_BYTES = 12;

function validateMetadata(metadata: CircuitMetadata): void {
  if (metadata.schema !== CIRCUIT_SCHEMA_VERSION) {
    throw new Error(`Unsupported circuit metadata schema: ${metadata.schema}`);
  }
  if (metadata.dataset !== DATASET_ID) {
    throw new Error(`Expected circuit dataset ${DATASET_ID}, got ${metadata.dataset}`);
  }
  if (metadata.circuit !== CIRCUIT_ID) {
    throw new Error(`Expected circuit id ${CIRCUIT_ID}, got ${metadata.circuit}`);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export class CircuitLoader {
  static decode(metadata: CircuitMetadata, binary: ArrayBuffer): CircuitGraph {
    validateMetadata(metadata);

    if (binary.byteLength < HEADER_BYTES) {
      throw new Error('Circuit byte length is shorter than the header');
    }

    const bytes = new Uint8Array(binary);
    const magic = new TextDecoder().decode(bytes.subarray(0, 4));
    if (magic !== MAGIC) {
      throw new Error(`Invalid circuit magic header: ${magic}`);
    }

    const view = new DataView(binary);
    const schema = view.getUint16(4, true);
    if (schema !== CIRCUIT_SCHEMA_VERSION) {
      throw new Error(`Unsupported circuit binary schema: ${schema}`);
    }

    const reserved = view.getUint16(6, true);
    if (reserved !== 0) {
      throw new Error(`Circuit reserved field must be 0, got ${reserved}`);
    }

    const edgeCount = view.getUint32(8, true);
    const expectedLength = HEADER_BYTES + edgeCount * EDGE_RECORD_BYTES;
    if (binary.byteLength !== expectedLength) {
      throw new Error(
        `Circuit byte length ${binary.byteLength} does not match edge count ${edgeCount} (${expectedLength} expected)`,
      );
    }

    const edges: CircuitEdge[] = [];
    const directedPairs = new Set<string>();
    for (let index = 0; index < edgeCount; index += 1) {
      const offset = HEADER_BYTES + index * EDGE_RECORD_BYTES;
      const sourceIndex = view.getUint32(offset, true);
      const targetIndex = view.getUint32(offset + 4, true);
      const weight = view.getUint32(offset + 8, true);

      if (
        sourceIndex >= metadata.neurons.length ||
        targetIndex >= metadata.neurons.length
      ) {
        throw new Error(
          `Circuit edge node index out of range: ${sourceIndex}->${targetIndex}`,
        );
      }
      if (weight === 0) {
        throw new Error(
          `Circuit edge weight must be positive: ${sourceIndex}->${targetIndex}`,
        );
      }

      const pair = `${sourceIndex}:${targetIndex}`;
      if (directedPairs.has(pair)) {
        throw new Error(`Duplicate circuit directed edge: ${sourceIndex}->${targetIndex}`);
      }
      directedPairs.add(pair);
      edges.push({ sourceIndex, targetIndex, weight });
    }

    return new CircuitGraph(metadata, edges);
  }

  static async load(baseUrl = './data/male-cns-v1/'): Promise<CircuitGraph> {
    const base = normalizeBaseUrl(baseUrl);
    const metadataResponse = await fetch(`${base}metadata.json`);
    if (!metadataResponse.ok) {
      throw new Error(
        `Failed to load metadata.json (HTTP ${metadataResponse.status})`,
      );
    }

    const metadata = (await metadataResponse.json()) as CircuitMetadata;
    validateMetadata(metadata);

    const binaryResponse = await fetch(`${base}circuit.bin`);
    if (!binaryResponse.ok) {
      throw new Error(
        `Failed to load circuit.bin (HTTP ${binaryResponse.status})`,
      );
    }

    return CircuitLoader.decode(metadata, await binaryResponse.arrayBuffer());
  }
}
