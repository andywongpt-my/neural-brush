export const DATASET_ID = 'male-cns:v1.0' as const;
export const SOURCE_ID = 'male-cns-public-bulk:v1.0' as const;
export const CIRCUIT_SCHEMA_VERSION = 1 as const;

export type SomaSide = 'L' | 'R' | 'M' | 'unknown';

export interface CircuitNeuron {
  bodyId: string;
  type: string | null;
  instance: string | null;
  somaSide: SomaSide;
  neurotransmitter: string | null;
  inputPort: boolean;
  descendingSeed: boolean;
}

export interface BehaviorPorts {
  turnLeft: string[];
  turnRight: string[];
  forward: string[];
}

export interface CircuitMetadata {
  schema: 1;
  dataset: 'male-cns:v1.0';
  circuit: 'dna-steering-v1';
  neurons: CircuitNeuron[];
  behaviorPorts: BehaviorPorts;
}

export interface CircuitManifest {
  schema: 1;
  dataset: 'male-cns:v1.0';
  circuit: 'dna-steering-v1';
  generatedAt: string;
  source: 'male-cns-public-bulk:v1.0';
  seedSelectors: ['DNa01', 'DNa02'];
  neuronCount: number;
  edgeCount: number;
  rawSha256: string;
  binarySha256: string;
}
