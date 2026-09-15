import * as THREE from 'three';
import type { FlyState } from './FlyTypes';

function createFlyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas unavailable for fly sprite');

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(48, 32);

  context.globalAlpha = 0.58;
  context.fillStyle = '#d9f0f2';
  context.beginPath();
  context.ellipse(-7, -14, 24, 10, -0.42, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(-7, 14, 24, 10, 0.42, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 1;
  context.fillStyle = '#17191b';
  context.beginPath();
  context.ellipse(4, 0, 24, 10, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#292d30';
  context.beginPath();
  context.arc(28, 0, 9, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#101214';
  context.lineWidth = 2.5;
  for (const y of [-7, 0, 7]) {
    context.beginPath();
    context.moveTo(1, y);
    context.lineTo(-22, y - 13);
    context.stroke();
    context.beginPath();
    context.moveTo(1, y);
    context.lineTo(-22, y + 13);
    context.stroke();
  }

  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class FlyRenderer {
  private readonly texture = createFlyTexture();
  private readonly material = new THREE.SpriteMaterial({
    map: this.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  private readonly sprite = new THREE.Sprite(this.material);
  private photoWidth = 0;
  private photoHeight = 0;
  private state: FlyState | null = null;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene) {
    this.sprite.visible = false;
    this.sprite.renderOrder = 10;
    this.scene.add(this.sprite);
  }

  setPhotoSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
      throw new RangeError('photo size must be finite and non-negative');
    }
    this.photoWidth = width;
    this.photoHeight = height;
    this.sprite.visible = width > 0 && height > 0;
    this.updateTransform();
  }

  update(state: FlyState): void {
    if (this.disposed) return;
    this.state = { ...state };
    this.updateTransform();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.sprite);
    this.material.dispose();
    this.texture.dispose();
  }

  private updateTransform(): void {
    if (!this.state || this.photoWidth <= 0 || this.photoHeight <= 0) return;
    const size = Math.max(12, Math.min(this.photoWidth, this.photoHeight) * 0.075);
    this.sprite.position.set(
      (this.state.x - 0.5) * this.photoWidth,
      (0.5 - this.state.y) * this.photoHeight,
      0.2,
    );
    this.sprite.scale.set(size * 1.5, size, 1);
    this.material.rotation = -this.state.heading;
  }
}
