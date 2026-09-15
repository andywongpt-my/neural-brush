import { describe, expect, it } from 'vitest';
import {
  CIRCUIT_SCHEMA_VERSION,
  DATASET_ID,
  SOURCE_ID,
} from '../../src/brain/CircuitTypes';

describe('circuit schema constants', () => {
  it('pins the V1 dataset, source, and schema', () => {
    expect(DATASET_ID).toBe('male-cns:v1.0');
    expect(SOURCE_ID).toBe('male-cns-public-bulk:v1.0');
    expect(CIRCUIT_SCHEMA_VERSION).toBe(1);
  });
});
