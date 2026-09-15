import * as THREE from 'three';

export class CanvasRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly plane = new THREE.Mesh(this.geometry, this.material);
  private readonly renderer: THREE.WebGLRenderer;
  private texture: THREE.Texture | null = null;
  private imageWidth = 0;
  private imageHeight = 0;
  private viewportWidth = 1;
  private viewportHeight = 1;

  constructor(host: HTMLElement) {
    this.camera.position.z = 1;
    this.scene.add(this.plane);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x080b0d, 1);
    this.renderer.domElement.className = 'photo-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Photo canvas');
    this.renderer.domElement.setAttribute('role', 'img');
    host.replaceChildren(this.renderer.domElement);
  }

  setImage(bitmap: ImageBitmap): void {
    const nextTexture = new THREE.Texture(bitmap);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;

    const previousTexture = this.texture;
    this.texture = nextTexture;
    this.imageWidth = bitmap.width;
    this.imageHeight = bitmap.height;
    this.material.map = nextTexture;
    this.material.needsUpdate = true;
    this.fitPhoto();
    this.render();
    previousTexture?.dispose();
  }

  resize(width: number, height: number, dpr: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);

    this.renderer.setPixelRatio(Math.min(2, Math.max(1, dpr)));
    this.renderer.setSize(this.viewportWidth, this.viewportHeight, false);

    this.camera.left = -this.viewportWidth / 2;
    this.camera.right = this.viewportWidth / 2;
    this.camera.top = this.viewportHeight / 2;
    this.camera.bottom = -this.viewportHeight / 2;
    this.camera.updateProjectionMatrix();

    this.fitPhoto();
    this.render();
  }

  dispose(): void {
    this.texture?.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private fitPhoto(): void {
    if (this.imageWidth <= 0 || this.imageHeight <= 0) {
      this.plane.scale.set(1, 1, 1);
      return;
    }

    const scale = Math.min(
      this.viewportWidth / this.imageWidth,
      this.viewportHeight / this.imageHeight,
    );
    this.plane.scale.set(this.imageWidth * scale, this.imageHeight * scale, 1);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
