import { AppError } from '../app/AppError';
import { AppState } from '../app/AppState';
import { ImageLoader } from '../image/ImageLoader';
import { CanvasRenderer } from '../render/CanvasRenderer';

export class CanvasPanel {
  private renderer: CanvasRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private bitmap: ImageBitmap | null = null;

  constructor(private readonly state: AppState) {}

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
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : new AppError('IMAGE_DECODE', cause);
      error.textContent = appError.message;
      error.hidden = false;
    }
  }
}
