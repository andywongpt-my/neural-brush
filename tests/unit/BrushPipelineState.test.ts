import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BrushPipeline } from '../../src/brush/BrushPipeline';
import type { BrushFrame } from '../../src/brush/BrushTypes';

class FakeRenderer {
  readonly targets: Array<THREE.WebGLRenderTarget | null> = [];
  renderCount = 0;

  setRenderTarget(target: THREE.WebGLRenderTarget | null): void {
    this.targets.push(target);
  }

  render(): void {
    this.renderCount += 1;
  }
}

const frame: BrushFrame = {
  centerX: 0.5,
  centerY: 0.5,
  velocityX: 1,
  velocityY: 0,
  radius: 0.05,
  smear: 0.8,
  saturation: 0.7,
  glow: 0.6,
};

describe('BrushPipeline render-target ownership', () => {
  it('keeps the immutable source texture reference across reset', () => {
    const renderer = new FakeRenderer();
    const pipeline = new BrushPipeline(renderer as unknown as THREE.WebGLRenderer);
    const source = new THREE.Texture();

    pipeline.initialize(source, 8, 8);
    pipeline.apply(frame, 'smear');
    pipeline.reset();

    expect(pipeline.sourceTexture).toBe(source);
    pipeline.dispose();
  });

  it('alternates ping/pong targets after each single pass', () => {
    const renderer = new FakeRenderer();
    const pipeline = new BrushPipeline(renderer as unknown as THREE.WebGLRenderer);
    const source = new THREE.Texture();
    pipeline.initialize(source, 8, 8);

    const initial = pipeline.currentTarget;
    pipeline.apply(frame, 'smear');
    const afterOne = pipeline.currentTarget;
    pipeline.apply(frame, 'saturation');
    const afterTwo = pipeline.currentTarget;

    expect(afterOne).not.toBe(initial);
    expect(afterTwo).toBe(initial);
    expect(renderer.targets.filter(Boolean).every((target) => target !== null)).toBe(true);
    pipeline.dispose();
  });

  it('applies blend as three ordered passes and ends on the opposite target', () => {
    const renderer = new FakeRenderer();
    const pipeline = new BrushPipeline(renderer as unknown as THREE.WebGLRenderer);
    pipeline.initialize(new THREE.Texture(), 8, 8);

    const initial = pipeline.currentTarget;
    const before = renderer.renderCount;
    pipeline.apply(frame, 'blend');

    expect(renderer.renderCount - before).toBe(3);
    expect(pipeline.currentTarget).not.toBe(initial);
    pipeline.dispose();
  });

  it('disposes idempotently', () => {
    const renderer = new FakeRenderer();
    const pipeline = new BrushPipeline(renderer as unknown as THREE.WebGLRenderer);
    pipeline.initialize(new THREE.Texture(), 8, 8);

    expect(() => pipeline.dispose()).not.toThrow();
    expect(() => pipeline.dispose()).not.toThrow();
  });
});
