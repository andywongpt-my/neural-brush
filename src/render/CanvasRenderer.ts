import * as THREE from 'three';
import { AppError } from '../app/AppError';
import { BrushPipeline } from '../brush/BrushPipeline';
import type { BrushFrame, BrushMode } from '../brush/BrushTypes';
import { ImageExporter } from '../export/ImageExporter';
import { FlyRenderer } from '../fly/FlyRenderer';
import type { FlyState } from '../fly/FlyTypes';
import {
  readEditedPatch as readTargetPatch,
  type ImageDataLike,
} from '../vision/EditedImageSampler';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class CanvasRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly plane = new THREE.Mesh(this.geometry, this.material);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly brushPipeline: BrushPipeline;
  private readonly flyRenderer: FlyRenderer;
  private sourceTexture: THREE.Texture | null = null;
  private imageWidth = 0;
  private imageHeight = 0;
  private viewportWidth = 1;
  private viewportHeight = 1;

  constructor(host: HTMLElement) {
    this.camera.position.z = 1;
    this.scene.add(this.plane);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: false,
      });
    } catch (cause) {
      throw new AppError('WEBGL_UNAVAILABLE', cause);
    }

    this.brushPipeline = new BrushPipeline(this.renderer);
    this.flyRenderer = new FlyRenderer(this.scene);
    this.renderer.setClearColor(0x080b0d, 1);
    this.renderer.domElement.className = 'photo-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Photo canvas');
    this.renderer.domElement.setAttribute('role', 'img');
    host.replaceChildren(this.renderer.domElement);
  }

  get canvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get hasImage(): boolean {
    return this.sourceTexture !== null;
  }

  setImage(bitmap: ImageBitmap): void {
    const nextTexture = new THREE.Texture(bitmap);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;

    const previousTexture = this.sourceTexture;
    this.sourceTexture = nextTexture;
    this.imageWidth = bitmap.width;
    this.imageHeight = bitmap.height;
    this.brushPipeline.initialize(nextTexture, bitmap.width, bitmap.height);
    this.material.map = this.brushPipeline.texture;
    this.material.needsUpdate = true;
    this.fitPhoto();
    this.render();
    previousTexture?.dispose();
  }

  applyBrush(frame: BrushFrame, mode: BrushMode): void {
    if (!this.sourceTexture) return;
    this.brushPipeline.apply(frame, mode);
    this.material.map = this.brushPipeline.texture;
    this.render();
  }

  updateFly(state: FlyState): void {
    this.flyRenderer.update(state);
    this.render();
  }

  clientToPhotoNormalized(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.sourceTexture || this.plane.scale.x <= 0 || this.plane.scale.y <= 0) {
      return null;
    }
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      throw new RangeError('pointer coordinates must be finite');
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const photoWidth = this.plane.scale.x;
    const photoHeight = this.plane.scale.y;
    const photoLeft = rect.left + (this.viewportWidth - photoWidth) / 2;
    const photoTop = rect.top + (this.viewportHeight - photoHeight) / 2;
    return {
      x: clamp01((clientX - photoLeft) / photoWidth),
      y: clamp01((clientY - photoTop) / photoHeight),
    };
  }

  photoNormalizedToClient(
    xNorm: number,
    yNorm: number,
  ): { x: number; y: number } | null {
    if (!this.sourceTexture || this.plane.scale.x <= 0 || this.plane.scale.y <= 0) {
      return null;
    }
    if (!Number.isFinite(xNorm) || !Number.isFinite(yNorm)) {
      throw new RangeError('normalized photo coordinates must be finite');
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const photoWidth = this.plane.scale.x;
    const photoHeight = this.plane.scale.y;
    const photoLeft = rect.left + (this.viewportWidth - photoWidth) / 2;
    const photoTop = rect.top + (this.viewportHeight - photoHeight) / 2;
    return {
      x: photoLeft + clamp01(xNorm) * photoWidth,
      y: photoTop + clamp01(yNorm) * photoHeight,
    };
  }

  readEditedPatch(
    xNorm: number,
    yNorm: number,
    radiusPx: number,
  ): ImageDataLike | null {
    if (!this.sourceTexture || this.imageWidth <= 0 || this.imageHeight <= 0) {
      return null;
    }

    return readTargetPatch(
      this.renderer,
      this.brushPipeline.currentTarget,
      this.imageWidth,
      this.imageHeight,
      xNorm,
      yNorm,
      radiusPx,
    );
  }

  editedChecksum(): number | null {
    if (!this.sourceTexture || this.imageWidth <= 0 || this.imageHeight <= 0) {
      return null;
    }

    const pixels = new Uint8Array(this.imageWidth * this.imageHeight * 4);
    this.renderer.readRenderTargetPixels(
      this.brushPipeline.currentTarget,
      0,
      0,
      this.imageWidth,
      this.imageHeight,
      pixels,
    );

    let hash = 0x811c9dc5;
    for (const byte of pixels) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  exportPNG(): Promise<Blob> {
    if (!this.sourceTexture) {
      return Promise.reject(
        new AppError('EXPORT_FAILED', new Error('No edited image is loaded')),
      );
    }
    return ImageExporter.exportPNG(this.renderer, this.brushPipeline.currentTarget);
  }

  exportJPEG(quality = 0.92): Promise<Blob> {
    if (!this.sourceTexture) {
      return Promise.reject(
        new AppError('EXPORT_FAILED', new Error('No edited image is loaded')),
      );
    }
    return ImageExporter.exportJPEG(
      this.renderer,
      this.brushPipeline.currentTarget,
      quality,
    );
  }

  resetImage(): void {
    if (!this.sourceTexture) return;
    this.brushPipeline.reset();
    this.material.map = this.brushPipeline.texture;
    this.render();
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
    this.flyRenderer.dispose();
    this.brushPipeline.dispose();
    this.sourceTexture?.dispose();
    this.sourceTexture = null;
    this.material.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private fitPhoto(): void {
    if (this.imageWidth <= 0 || this.imageHeight <= 0) {
      this.plane.scale.set(1, 1, 1);
      this.flyRenderer.setPhotoSize(0, 0);
      return;
    }

    const scale = Math.min(
      this.viewportWidth / this.imageWidth,
      this.viewportHeight / this.imageHeight,
    );
    const width = this.imageWidth * scale;
    const height = this.imageHeight * scale;
    this.plane.scale.set(width, height, 1);
    this.flyRenderer.setPhotoSize(width, height);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
