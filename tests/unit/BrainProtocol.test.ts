import { describe, expect, it } from 'vitest';
import { isWorkerCommand } from '../../src/brain/BrainProtocol';

describe('BrainProtocol', () => {
  it('rejects unknown command types', () => {
    expect(isWorkerCommand({ type: 'rewire-everything' })).toBe(false);
  });

  it('accepts lifecycle commands with no payload', () => {
    for (const type of ['pause', 'resume', 'reset', 'dispose'] as const) {
      expect(isWorkerCommand({ type })).toBe(true);
    }
  });

  it('rejects malformed sensory and modulation commands', () => {
    expect(isWorkerCommand({ type: 'sensory', drive: [1, 2] })).toBe(false);
    expect(
      isWorkerCommand({
        type: 'modulation',
        modulation: {
          stimulation: new Float32Array(1),
          inhibition: new Float32Array(1),
          connectionGain: [1],
        },
      }),
    ).toBe(false);
  });
});
