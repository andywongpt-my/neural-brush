import * as THREE from 'three';
import { FullscreenPass } from './FullscreenPass';
import { GlowPass } from './GlowPass';
import { SaturationPass } from './SaturationPass';
import { SmearPass } from './SmearPass';
import type { BrushFrame, BrushMode } from './BrushTypes';
import { FULLSCREEN_VERTEX_SHADER } from './shaders/common.glsl';

function makeTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.generateMipmaps = false;
  return target;
}

export class BrushPipeline {
  private readonly fullscreen: FullscreenPass;
  private readonly smear = new SmearPass();
  private readonly saturation = new SaturationPass();
  private readonly glow = new GlowPass();
  private readonly copyMaterial = new THREE.ShaderMaterial({
    uniforms: { uInput: { value: null } },
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInput;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(uInput, vUv);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private source: THREE.Texture | null = null;
  private currentIndex = 0;
  private disposed = false;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.fullscreen = new FullscreenPass(renderer);
  }

  get sourceTexture(): THREE.Texture | null {
    return this.source;
  }

  get currentTarget(): THREE.WebGLRenderTarget {
    if (!this.targets) throw new Error('BrushPipeline is not initialized');
    return this.targets[this.currentIndex];
  }

  get texture(): THREE.Texture {
    return this.currentTarget.texture;
  }

  initialize(source: THREE.Texture, width: number, height: number): void {
    if (this.disposed) throw new Error('BrushPipeline is disposed');
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError('BrushPipeline dimensions must be positive integers');
    }

    this.disposeTargets();
    this.source = source;
    this.targets = [makeTarget(width, height), makeTarget(width, height)];
    this.currentIndex = 0;
    this.fullscreen.render(this.copyMaterial, source, this.targets[0]);
  }

  apply(frame: BrushFrame, mode: BrushMode): void {
    if (!this.targets || !this.source) throw new Error('BrushPipeline is not initialized');
    if (this.disposed) throw new Error('BrushPipeline is disposed');

    switch (mode) {
      case 'smear':
        this.smear.configure(frame);
        this.run(this.smear.material);
        return;
      case 'saturation':
        this.saturation.configure(frame);
        this.run(this.saturation.material);
        return;
      case 'glow':
        this.glow.configure(frame);
        this.run(this.glow.material);
        return;
      case 'blend':
        this.smear.configure(frame);
        this.run(this.smear.material);
        this.saturation.configure(frame);
        this.run(this.saturation.material);
        this.glow.configure(frame);
        this.run(this.glow.material);
        return;
    }
  }

  reset(): void {
    if (!this.targets || !this.source) throw new Error('BrushPipeline is not initialized');
    if (this.disposed) throw new Error('BrushPipeline is disposed');
    this.currentIndex = 0;
    this.fullscreen.render(this.copyMaterial, this.source, this.targets[0]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeTargets();
    this.source = null;
    this.smear.dispose();
    this.saturation.dispose();
    this.glow.dispose();
    this.copyMaterial.dispose();
    this.fullscreen.dispose();
  }

  private run(material: THREE.ShaderMaterial): void {
    if (!this.targets) throw new Error('BrushPipeline is not initialized');
    const input = this.targets[this.currentIndex];
    const outputIndex = this.currentIndex === 0 ? 1 : 0;
    const output = this.targets[outputIndex];
    if (input === output) throw new Error('BrushPipeline cannot read and write the same target');

    this.fullscreen.render(material, input.texture, output);
    this.currentIndex = outputIndex;
  }

  private disposeTargets(): void {
    if (!this.targets) return;
    this.targets[0].dispose();
    this.targets[1].dispose();
    this.targets = null;
  }
}
