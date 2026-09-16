export interface PresetControlActions {
  onShare(): string;
  onExport(): void;
  onImport(file: File): Promise<void>;
  onReset(): void;
}

export class PresetControls {
  private warning: HTMLElement | null = null;
  private warningMessage: HTMLElement | null = null;
  private shareLink: HTMLInputElement | null = null;

  constructor(private readonly actions: PresetControlActions) {}

  mount(host: HTMLElement): void {
    const root = document.createElement('section');
    root.className = 'preset-controls';
    root.setAttribute('aria-label', 'Brain Preset controls');

    const actions = document.createElement('div');
    actions.className = 'preset-actions';

    const shareButton = this.button('Share Brain');
    const exportButton = this.button('Export Brain');
    const importButton = this.button('Import Brain');
    const resetButton = this.button('Reset Brain');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.neuralbrush.json,.json,application/json';
    fileInput.hidden = true;
    fileInput.setAttribute('aria-label', 'Import Brain file');

    actions.append(shareButton, exportButton, importButton, resetButton, fileInput);

    const shareRow = document.createElement('label');
    shareRow.className = 'preset-share-link';
    shareRow.hidden = true;
    const shareLabel = document.createElement('span');
    shareLabel.textContent = 'Shared Brain link';
    const shareLink = document.createElement('input');
    shareLink.type = 'text';
    shareLink.readOnly = true;
    shareLink.setAttribute('aria-label', 'Shared Brain link');
    shareLink.addEventListener('focus', () => shareLink.select());
    shareLink.addEventListener('click', () => shareLink.select());
    shareRow.append(shareLabel, shareLink);
    this.shareLink = shareLink;

    const warning = document.createElement('div');
    warning.className = 'preset-warning';
    warning.setAttribute('role', 'alert');
    warning.setAttribute('aria-label', 'Preset warning');
    warning.hidden = true;
    const warningMessage = document.createElement('span');
    const dismiss = this.button('Dismiss preset warning');
    dismiss.addEventListener('click', () => this.clearWarning());
    warning.append(warningMessage, dismiss);
    this.warning = warning;
    this.warningMessage = warningMessage;

    shareButton.addEventListener('click', () => {
      try {
        const url = this.actions.onShare();
        shareLink.value = url;
        shareRow.hidden = false;
        shareLink.select();
        this.clearWarning();
      } catch (cause) {
        this.showWarning(this.message('Unable to share Brain preset', cause));
      }
    });

    exportButton.addEventListener('click', () => {
      try {
        this.actions.onExport();
        this.clearWarning();
      } catch (cause) {
        this.showWarning(this.message('Unable to export Brain preset', cause));
      }
    });

    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void this.actions
        .onImport(file)
        .then(() => this.clearWarning())
        .catch((cause: unknown) => {
          this.showWarning(this.message('Unable to import Brain preset', cause));
        })
        .finally(() => {
          fileInput.value = '';
        });
    });

    resetButton.addEventListener('click', () => {
      try {
        this.actions.onReset();
        this.clearWarning();
      } catch (cause) {
        this.showWarning(this.message('Unable to reset Brain preset', cause));
      }
    });

    root.append(actions, shareRow, warning);
    host.replaceChildren(root);
  }

  showWarning(message: string): void {
    if (!this.warning || !this.warningMessage) return;
    this.warningMessage.textContent = message;
    this.warning.hidden = false;
  }

  clearWarning(): void {
    if (!this.warning || !this.warningMessage) return;
    this.warningMessage.textContent = '';
    this.warning.hidden = true;
  }

  private button(text: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    return button;
  }

  private message(prefix: string, cause: unknown): string {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return `${prefix}: ${detail}`;
  }
}
