import { AppError } from '../app/AppError';
import { AppState } from '../app/AppState';
import type { BrushFrame, BrushMode } from '../brush/BrushTypes';
import { FlyPointerInteraction } from '../fly/FlyPointerInteraction';
import type { FlyState } from '../fly/FlyTypes';
import { ImageLoader } from '../image/ImageLoader';
import { CanvasRenderer } from '../render/CanvasRenderer';
import type { ImageDataLike } from '../vision/EditedImageSampler';

export interface CanvasFlyControls {
  getFlyState(): FlyState;
  onDragStart(x: number, y: number): void;
  onDrag(x: number, y: number): void;
  onDragEnd(): void;
  onFollowTarget(x: number, y: number): void;
  onAutonomous(): void;
}

export class CanvasPanel {
  private renderer: CanvasRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private bitmap: ImageBitmap | null = null;
  private pointerInteraction: FlyPointerInteraction | null = null;
  private pointerCleanup: (() => void) | null = null;

  constructor(
    private readonly state: AppState,
    private readonly flyControls?: CanvasFlyControls,
    private readonly onImageChanged?: () => void,
  ) {}

  mount(host: HTMLElement): void {
    const header = document.createElement('header');
    header.className = 'panel-header';

    const identity = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Canvas';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Live photo workspace';
    identity.append(title, subtitle);

    const autonomousButton = document.createElement('button');
    autonomousButton.type = 'button';
    autonomousButton.textContent = 'Autonomous';
    autonomousButton.dataset.testid = 'fly-autonomous';
    autonomousButton.addEventListener('click', () => this.flyControls?.onAutonomous());

    header.append(identity, autonomousButton);

    const uploadHost = document.createElement('div');
    uploadHost.className = 'upload-drop-zone';
    uploadHost.setAttribute('aria-label', 'Photo upload area');

    const label = document.createElement('label');
    label.className = 'photo-picker';
    label.textContent = 'Choose a photo';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.setAttribute('aria-label', 'Choose photo');
    label.append(input);

    const dropHint = document.createElement('span');
    dropHint.textContent = 'or drop PNG, JPEG, or WebP here';

    const imageName = document.createElement('p');
    imageName.className = 'image-name';
    imageName.textContent = 'No photo loaded';

    const error = document.createElement('p');
    error.className = 'image-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    uploadHost.append(label, dropHint, imageName, error);

    const threeHost = document.createElement('div');
    threeHost.className = 'three-canvas-host';
    threeHost.setAttribute('aria-label', 'Three.js canvas host');

    host.replaceChildren(header, uploadHost, threeHost);

    this.renderer?.dispose();
    this.resizeObserver?.disconnect();
    this.pointerCleanup?.();
    this.renderer = new CanvasRenderer(threeHost);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry || !this.renderer) return;
      const { width, height } = entry.contentRect;
      this.renderer.resize(width, height, window.devicePixelRatio);
    });
    this.resizeObserver.observe(threeHost);
    this.bindPointerControls();

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void this.loadFile(file, imageName, error);
    });

    uploadHost.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    uploadHost.addEventListener('drop', (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file) void this.loadFile(file, imageName, error);
    });
  }

  applyBrush(frame: BrushFrame, mode: BrushMode): void {
    this.renderer?.applyBrush(frame, mode);
  }

  updateFly(state: FlyState): void {
    this.renderer?.updateFly(state);
  }

  readEditedPatch(
    xNorm: number,
    yNorm: number,
    radiusPx: number,
  ): ImageDataLike | null {
    return this.renderer?.readEditedPatch(xNorm, yNorm, radiusPx) ?? null;
  }

  resetImage(): void {
    this.renderer?.resetImage();
  }

  dispose(): void {
    this.pointerCleanup?.();
    this.pointerCleanup = null;
    this.pointerInteraction = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.bitmap?.close();
    this.bitmap = null;
  }

  private bindPointerControls(): void {
    if (!this.renderer || !this.flyControls) return;
    const canvas = this.renderer.canvasElement;
    canvas.style.touchAction = 'none';

    const interaction = new FlyPointerInteraction({
      onDragStart: this.flyControls.onDragStart,
      onDrag: this.flyControls.onDrag,
      onDragEnd: this.flyControls.onDragEnd,
      onFollowTarget: this.flyControls.onFollowTarget,
    });
    this.pointerInteraction = interaction;
    let activePointerId: number | null = null;

    const normalize = (event: PointerEvent) =>
      this.renderer?.clientToPhotoNormalized(event.clientX, event.clientY) ?? null;

    const onPointerDown = (event: PointerEvent): void => {
      const point = normalize(event);
      if (!point) return;
      const fly = this.flyControls?.getFlyState();
      if (!fly) return;
      event.preventDefault();
      const result = interaction.pointerDown(point.x, point.y, fly.x, fly.y);
      if (result === 'dragging') {
        activePointerId = event.pointerId;
        canvas.setPointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!interaction.isDragging || event.pointerId !== activePointerId) return;
      const point = normalize(event);
      if (!point) return;
      event.preventDefault();
      interaction.pointerMove(point.x, point.y);
    };

    const endPointer = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;
      interaction.pointerUp();
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      activePointerId = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    this.pointerCleanup = () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
    };
  }

  private async loadFile(file: File, imageName: HTMLElement, error: HTMLElement): Promise<void> {
    try {
      const nextBitmap = await ImageLoader.decode(file);
      this.renderer?.setImage(nextBitmap);
      this.bitmap?.close();
      this.bitmap = nextBitmap;
      this.state.setImageName(file.name);
      imageName.textContent = file.name;
      error.hidden = true;
      error.textContent = '';
      this.onImageChanged?.();
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : new AppError('IMAGE_DECODE', cause);
      error.textContent = appError.message;
      error.hidden = false;
    }
  }
}
