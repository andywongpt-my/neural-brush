import { describe, expect, it } from 'vitest';
import {
  edgeVisualIntensity,
  nodeVisual,
} from '../../src/brain/BrainVisuals';

describe('nodeVisual', () => {
  it('maps bounded activation to bounded scale and brightness', () => {
    expect(nodeVisual(-10)).toEqual(nodeVisual(0));
    expect(nodeVisual(10)).toEqual(nodeVisual(1));

    const low = nodeVisual(0);
    const high = nodeVisual(1);
    expect(low.scale).toBeGreaterThan(0);
    expect(high.scale).toBeGreaterThan(low.scale);
    expect(low.brightness).toBeGreaterThanOrEqual(0);
    expect(high.brightness).toBeLessThanOrEqual(1);
  });

  it('is deterministic', () => {
    expect(nodeVisual(0.4375)).toEqual(nodeVisual(0.4375));
  });
});

describe('edgeVisualIntensity', () => {
  it('increases with source activity and source connection weight', () => {
    const quiet = edgeVisualIntensity(0, 100);
    const active = edgeVisualIntensity(1, 100);
    const heavier = edgeVisualIntensity(1, 1000);

    expect(active).toBeGreaterThan(quiet);
    expect(heavier).toBeGreaterThan(active);
  });

  it('stays within 0..1 without assigning excitatory or inhibitory sign', () => {
    expect(edgeVisualIntensity(-1, 1)).toBeGreaterThanOrEqual(0);
    expect(edgeVisualIntensity(5, Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(1);
  });
});
