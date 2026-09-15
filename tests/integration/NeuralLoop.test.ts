import { describe, expect, it } from 'vitest';
import { BrainEngine } from '../../src/brain/BrainEngine';
import { CircuitGraph } from '../../src/brain/CircuitGraph';
import { toEngineGraph } from '../../src/brain/EngineGraphAdapter';
import type { CircuitMetadata } from '../../src/brain/CircuitTypes';
import type { ModulationSnapshot } from '../../src/brain/BrainRuntimeTypes';
import { FlyPhysics } from '../../src/fly/FlyPhysics';
import type { FlyState } from '../../src/fly/FlyTypes';
import { LocalVision } from '../../src/vision/LocalVision';
import { SensoryAdapter } from '../../src/vision/SensoryAdapter';

const metadata: CircuitMetadata = {
  schema: 1,
  dataset: 'male-cns:v1.0',
  circuit: 'dna-steering-v1',
  neurons: [
    { bodyId: '100', type: 'visual-frontier', instance: null, somaSide: 'unknown', neurotransmitter: null, inputPort: true, descendingSeed: false },
    { bodyId: '200', type: 'DNa-left', instance: null, somaSide: 'L', neurotransmitter: null, inputPort: false, descendingSeed: true },
    { bodyId: '300', type: 'DNa-right', instance: null, somaSide: 'R', neurotransmitter: null, inputPort: false, descendingSeed: true },
    { bodyId: '400', type: 'forward-test', instance: null, somaSide: 'M', neurotransmitter: null, inputPort: false, descendingSeed: false },
  ],
  behaviorPorts: {
    turnLeft: ['200'],
    turnRight: ['300'],
    forward: ['400'],
  },
};

const circuit = new CircuitGraph(metadata, [
  { sourceIndex: 0, targetIndex: 1, weight: 5 },
  { sourceIndex: 0, targetIndex: 2, weight: 20 },
  { sourceIndex: 0, targetIndex: 3, weight: 25 },
]);

const pixels = new Uint8ClampedArray(3 * 3 * 4);
for (let offset = 0; offset < pixels.length; offset += 4) {
  pixels[offset] = 240;
  pixels[offset + 1] = 220;
  pixels[offset + 2] = 180;
  pixels[offset + 3] = 255;
}

function neutral(nodeCount: number, edgeCount: number): ModulationSnapshot {
  const connectionGain = new Float32Array(edgeCount);
  connectionGain.fill(1);
  return {
    stimulation: new Float32Array(nodeCount),
    inhibition: new Float32Array(nodeCount),
    connectionGain,
  };
}

function run(seed: number): FlyState {
  const graph = toEngineGraph(circuit);
  const engine = new BrainEngine(graph, seed);
  const modulation = neutral(graph.nodeCount, graph.weight.length);
  let fly: FlyState = {
    x: 0.5,
    y: 0.5,
    heading: 0,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
  };

  for (let step = 0; step < 120; step += 1) {
    const sample = LocalVision.sample(pixels, 3, 3, fly.x, fly.y, 1);
    const drive = SensoryAdapter.map(sample, graph.inputPorts, graph.nodeCount);
    const result = engine.step(1000 / 60, drive, modulation);
    fly = FlyPhysics.step(fly, result.behavior, 1 / 60);
  }

  return fly;
}

describe('Neural loop integration', () => {
  it('maps immutable circuit metadata into engine ports by body ID', () => {
    const graph = toEngineGraph(circuit);
    expect([...graph.inputPorts]).toEqual([0]);
    expect([...graph.turnLeftPorts]).toEqual([1]);
    expect([...graph.turnRightPorts]).toEqual([2]);
    expect([...graph.forwardPorts]).toEqual([3]);
    expect([...graph.weight]).toEqual([5, 20, 25]);
  });

  it('moves the fly through image -> sensory -> brain -> behavior -> physics', () => {
    const finalState = run(2026);
    expect(Math.hypot(finalState.x - 0.5, finalState.y - 0.5)).toBeGreaterThan(0.01);
  });

  it('reproduces exactly the same final state for the same seed and input stream', () => {
    expect(run(42)).toEqual(run(42));
  });
});
