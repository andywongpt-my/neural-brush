import * as THREE from 'three';

export class FullscreenPass {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly placeholderMaterial = new THREE.MeshBasicMaterial();
  private readonly quad = new THREE.Mesh(this.geometry, this.placeholderMaterial);
  private disposed = false;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.scene.add(this.quad);
  }

  render(
    material: THREE.ShaderMaterial,
    inputTexture: THREE.Texture,
    outputTarget: THREE.WebGLRenderTarget,
  ): void {
    if (this.disposed) throw new Error('FullscreenPass is disposed');
    const inputUniform = material.uniforms.uInput;
    if (!inputUniform) throw new Error('Fullscreen material requires uInput uniform');

    inputUniform.value = inputTexture;
    this.quad.material = material;
    this.renderer.setRenderTarget(outputTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.geometry.dispose();
    this.placeholderMaterial.dispose();
  }
}
