export class CanvasPanel {
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
    uploadHost.textContent = 'Drop or choose a photo';

    const threeHost = document.createElement('div');
    threeHost.className = 'three-canvas-host';
    threeHost.setAttribute('aria-label', 'Three.js canvas host');

    host.replaceChildren(header, uploadHost, threeHost);
  }
}
