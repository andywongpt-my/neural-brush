import { describe, expect, it } from 'vitest';
import { packCircuit } from '../../tools/malecns-export/pack';
import fixture from '../fixtures/raw-circuit.fixture.json';

describe('packCircuit', () => {
  it('writes NBC1 and schema version 1', () => {
    const { binary } = packCircuit(fixture);

    expect(new TextDecoder().decode(binary.slice(0, 4))).toBe('NBC1');
    expect(new DataView(binary.buffer).getUint16(4, true)).toBe(1);
  });
});
