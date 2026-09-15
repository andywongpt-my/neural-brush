export interface SplitViewMountResult {
  brainHost: HTMLElement;
  canvasHost: HTMLElement;
}

export interface SplitViewOptions {
  initialRatio: number;
  onRatioChange: (ratio: number) => void;
}

export class SplitView {
  private container: HTMLElement | null = null;
  private separator: HTMLElement | null = null;
  private ratio: number;

  constructor(private readonly options: SplitViewOptions) {
    this.ratio = options.initialRatio;
  }

  mount(host: HTMLElement): SplitViewMountResult {
    const container = document.createElement('main');
    container.className = 'split-view';

    const brainHost = document.createElement('section');
    brainHost.className = 'workspace-panel brain-region';
    brainHost.setAttribute('aria-label', 'Brain');

    const separator = document.createElement('div');
    separator.className = 'split-divider';
    separator.setAttribute('role', 'separator');
    separator.setAttribute('aria-label', 'Resize Brain and Canvas panels');
    separator.setAttribute('aria-orientation', 'vertical');
    separator.tabIndex = 0;

    const canvasHost = document.createElement('section');
    canvasHost.className = 'workspace-panel canvas-region';
    canvasHost.setAttribute('aria-label', 'Canvas');

    container.append(brainHost, separator, canvasHost);
    host.replaceChildren(container);

    this.container = container;
    this.separator = separator;
    this.setRatio(this.ratio);
    this.bindDivider();

    return { brainHost, canvasHost };
  }

  setRatio(ratio: number): void {
    this.ratio = ratio;
    if (!this.container || !this.separator) return;

    const brainPercent = ratio * 100;
    this.container.style.setProperty('--brain-ratio', `${brainPercent}%`);
    this.container.style.setProperty('--canvas-ratio', `${100 - brainPercent}%`);
    this.separator.setAttribute('aria-valuemin', '35');
    this.separator.setAttribute('aria-valuemax', '75');
    this.separator.setAttribute('aria-valuenow', String(Math.round(brainPercent)));
  }

  private bindDivider(): void {
    if (!this.container || !this.separator) return;

    const container = this.container;
    const separator = this.separator;
    let dragging = false;
    let pointerId: number | null = null;

    separator.addEventListener('pointerdown', (event) => {
      if (!window.matchMedia('(min-width: 800px)').matches) return;
      dragging = true;
      pointerId = event.pointerId;
      separator.setPointerCapture(event.pointerId);
    });

    separator.addEventListener('pointermove', (event) => {
      if (!dragging || pointerId !== event.pointerId) return;
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0) return;
      this.options.onRatioChange((event.clientX - bounds.left) / bounds.width);
    });

    const stopDragging = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      dragging = false;
      pointerId = null;
    };

    separator.addEventListener('pointerup', stopDragging);
    separator.addEventListener('pointercancel', stopDragging);

    separator.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -0.02 : 0.02;
      this.options.onRatioChange(this.ratio + delta);
    });
  }
}
