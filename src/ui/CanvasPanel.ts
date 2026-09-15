import { AppError } from '../app/AppError';
import { AppState } from '../app/AppState';
import { ImageLoader } from '../image/ImageLoader';
import { CanvasRenderer } from '../render/CanvasRenderer';

const MAX_VISION_DIMENSION = 512;

export interface VisionFrame {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

function extractVisionFrame(bitmap: ImageBitmap): VisionFrame {
  const scale = Math.min(
    1,
    MAX_VISION_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('2D canvas is unavailable for local visual sampling');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    pixels: imageData.data.slice(),
    width,
    height,
  };
}

export class CanvasPanel {
  private renderer: CanvasRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private bitmap: ImageBitmap | null = null;

  constructor(
    private readonly state: AppState,
    private readonly onVisionFrame?: (frame: VisionFrame | null) => void,
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
    header.append(identity);

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
    this.renderer = new CanvasRenderer(threeHost);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry || !this.renderer) return;
      const { width, height } = entry.contentRect;
      this.renderer.resize(width, height, window.devicePixelRatio);
    });
    this.resizeObserver.observe(threeHost);

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

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.bitmap?.close();
    this.bitmap = null;
    this.onVisionFrame?.(null);
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

      if (this.onVisionFrame) {
        try {
          this.onVisionFrame(extractVisionFrame(nextBitmap));
        } catch {
          this.onVisionFrame(null);
        }
      }
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : new AppError('IMAGE_DECODE', cause);
      error.textContent = appError.message;
      error.hidden = false;
    }
  }
}
