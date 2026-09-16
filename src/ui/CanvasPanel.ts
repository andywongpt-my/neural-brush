import { AppError } from '../app/AppError';
import { AppState } from '../app/AppState';
import type { BrushFrame, BrushMode } from '../brush/BrushTypes';
import {
  PROCESS_RECORDING_FILENAME,
  ProcessRecorder,
  ProcessRecorderError,
} from '../export/ProcessRecorder';
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
  private readonly processRecorder = new ProcessRecorder();
  private recordedProcessBlob: Blob | null = null;

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

    const actionHost = document.createElement('div');
    actionHost.className = 'canvas-actions';

    const autonomousButton = document.createElement('button');
    autonomousButton.type = 'button';
    autonomousButton.textContent = 'Autonomous';
    autonomousButton.dataset.testid = 'fly-autonomous';
    autonomousButton.addEventListener('click', () => this.flyControls?.onAutonomous());

    const exportPNGButton = document.createElement('button');
    exportPNGButton.type = 'button';
    exportPNGButton.textContent = 'Export PNG';
    exportPNGButton.disabled = true;

    const exportJPEGButton = document.createElement('button');
    exportJPEGButton.type = 'button';
    exportJPEGButton.textContent = 'Export JPEG';
    exportJPEGButton.disabled = true;

    const recordButton = document.createElement('button');
    recordButton.type = 'button';
    recordButton.textContent = 'Record Process';
    recordButton.disabled = true;

    const stopRecordingButton = document.createElement('button');
    stopRecordingButton.type = 'button';
    stopRecordingButton.textContent = 'Stop Recording';
    stopRecordingButton.disabled = true;

    const downloadRecordingButton = document.createElement('button');
    downloadRecordingButton.type = 'button';
    downloadRecordingButton.textContent = 'Download Recording';
    downloadRecordingButton.disabled = true;

    actionHost.append(
      autonomousButton,
      exportPNGButton,
      exportJPEGButton,
      recordButton,
      stopRecordingButton,
      downloadRecordingButton,
    );
    header.append(identity, actionHost);

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

    const recordingStatus = document.createElement('p');
    recordingStatus.className = 'recording-status';
    recordingStatus.setAttribute('aria-live', 'polite');

    const error = document.createElement('p');
    error.className = 'image-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    uploadHost.append(label, dropHint, imageName, recordingStatus, error);

    const threeHost = document.createElement('div');
    threeHost.className = 'three-canvas-host';
    threeHost.setAttribute('aria-label', 'Three.js canvas host');

    host.replaceChildren(header, uploadHost, threeHost);

    if (this.processRecorder.isRecording) {
      void this.processRecorder.stop().catch(() => undefined);
    }
    this.recordedProcessBlob = null;
    this.renderer?.dispose();
    this.resizeObserver?.disconnect();
    this.pointerCleanup?.();
    this.renderer = new CanvasRenderer(threeHost);
    const recordingSupported = ProcessRecorder.isSupported(this.renderer.canvasElement);
    recordingStatus.textContent = recordingSupported
      ? 'WebM process recording is available.'
      : 'WebM process recording is not supported by this browser. PNG/JPEG export is still available.';

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry || !this.renderer) return;
      const { width, height } = entry.contentRect;
      this.renderer.resize(width, height, window.devicePixelRatio);
    });
    this.resizeObserver.observe(threeHost);
    this.bindPointerControls();

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        void this.loadFile(
          file,
          imageName,
          error,
          exportPNGButton,
          exportJPEGButton,
          recordButton,
          downloadRecordingButton,
          recordingSupported,
        );
      }
    });

    uploadHost.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    uploadHost.addEventListener('drop', (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file) {
        void this.loadFile(
          file,
          imageName,
          error,
          exportPNGButton,
          exportJPEGButton,
          recordButton,
          downloadRecordingButton,
          recordingSupported,
        );
      }
    });

    exportPNGButton.addEventListener('click', () => {
      void this.exportArtwork('png', error);
    });
    exportJPEGButton.addEventListener('click', () => {
      void this.exportArtwork('jpeg', error);
    });

    recordButton.addEventListener('click', () => {
      if (!this.renderer?.hasImage) return;
      try {
        this.processRecorder.start(this.renderer.canvasElement);
        this.recordedProcessBlob = null;
        recordButton.disabled = true;
        stopRecordingButton.disabled = false;
        downloadRecordingButton.disabled = true;
        recordingStatus.textContent = 'Recording process…';
        error.hidden = true;
        error.textContent = '';
      } catch (cause) {
        this.showRecordingError(cause, error);
      }
    });

    stopRecordingButton.addEventListener('click', () => {
      stopRecordingButton.disabled = true;
      void this.processRecorder
        .stop()
        .then((blob) => {
          if (blob.size <= 0) {
            throw new ProcessRecorderError('process recording produced no video data');
          }
          this.recordedProcessBlob = blob;
          recordButton.disabled = !recordingSupported || !this.renderer?.hasImage;
          downloadRecordingButton.disabled = false;
          recordingStatus.textContent = 'Recording ready to download.';
          error.hidden = true;
          error.textContent = '';
        })
        .catch((cause: unknown) => {
          recordButton.disabled = !recordingSupported || !this.renderer?.hasImage;
          downloadRecordingButton.disabled = true;
          this.showRecordingError(cause, error);
        });
    });

    downloadRecordingButton.addEventListener('click', () => {
      if (!this.recordedProcessBlob) return;
      this.downloadBlob(this.recordedProcessBlob, PROCESS_RECORDING_FILENAME);
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

  editedChecksum(): number | null {
    return this.renderer?.editedChecksum() ?? null;
  }

  photoClientPoint(
    xNorm: number,
    yNorm: number,
  ): { x: number; y: number } | null {
    return this.renderer?.photoNormalizedToClient(xNorm, yNorm) ?? null;
  }

  resetImage(): void {
    this.renderer?.resetImage();
  }

  dispose(): void {
    if (this.processRecorder.isRecording) {
      void this.processRecorder.stop().catch(() => undefined);
    }
    this.recordedProcessBlob = null;
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

  private async loadFile(
    file: File,
    imageName: HTMLElement,
    error: HTMLElement,
    exportPNGButton: HTMLButtonElement,
    exportJPEGButton: HTMLButtonElement,
    recordButton: HTMLButtonElement,
    downloadRecordingButton: HTMLButtonElement,
    recordingSupported: boolean,
  ): Promise<void> {
    try {
      const nextBitmap = await ImageLoader.decode(file);
      this.renderer?.setImage(nextBitmap);
      this.bitmap?.close();
      this.bitmap = nextBitmap;
      this.state.setImageName(file.name);
      imageName.textContent = file.name;
      error.hidden = true;
      error.textContent = '';
      exportPNGButton.disabled = false;
      exportJPEGButton.disabled = false;
      recordButton.disabled = !recordingSupported || this.processRecorder.isRecording;
      this.recordedProcessBlob = null;
      downloadRecordingButton.disabled = true;
      this.onImageChanged?.();
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : new AppError('IMAGE_DECODE', cause);
      error.textContent = appError.message;
      error.hidden = false;
    }
  }

  private async exportArtwork(
    format: 'png' | 'jpeg',
    error: HTMLElement,
  ): Promise<void> {
    try {
      if (!this.renderer) throw new AppError('EXPORT_FAILED');
      const blob =
        format === 'png'
          ? await this.renderer.exportPNG()
          : await this.renderer.exportJPEG();
      const filename = format === 'png' ? 'neural-brush.png' : 'neural-brush.jpg';
      this.downloadBlob(blob, filename);
      error.hidden = true;
      error.textContent = '';
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : new AppError('EXPORT_FAILED', cause);
      error.textContent = appError.message;
      error.hidden = false;
    }
  }

  private showRecordingError(cause: unknown, error: HTMLElement): void {
    const message =
      cause instanceof Error ? cause.message : 'WebM process recording failed';
    error.textContent = message;
    error.hidden = false;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
