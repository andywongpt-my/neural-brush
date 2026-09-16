export class AboutDialog {
  private trigger: HTMLButtonElement | null = null;
  private dialog: HTMLDialogElement | null = null;

  mount(host: HTMLElement): void {
    this.dispose();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'about-trigger';
    trigger.textContent = 'About / Science';

    const dialog = document.createElement('dialog');
    dialog.className = 'about-dialog';
    dialog.setAttribute('aria-labelledby', 'about-neural-brush-title');

    const article = document.createElement('article');
    article.className = 'about-dialog-content';

    const header = document.createElement('header');
    header.className = 'about-dialog-header';
    const title = document.createElement('h2');
    title.id = 'about-neural-brush-title';
    title.textContent = 'About Neural Brush';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close About';
    header.append(title, close);

    const intro = document.createElement('p');
    intro.textContent =
      'Neural Brush uses a selected subgraph derived from MaleCNS male-cns:v1.0. Source topology, body IDs, source connection weights, and available annotations in that subgraph are connectome-derived.';

    const model = document.createElement('p');
    model.textContent =
      'Neural activity equations are simplified modeling assumptions, not reconstructed electrophysiology. Photo feature injection is a synthetic sensory adapter.';

    const art = document.createElement('p');
    art.textContent =
      'Smear, Saturation, and Glow are artistic mappings, not biological motor outputs. Any future optional AI semantic vision would be external synthetic modulation.';

    const privacy = document.createElement('p');
    privacy.textContent =
      'Static V1 source photos are processed locally in the browser. Source photos are not included in Brain Presets or share fragments, and Neural Brush requires no backend or cloud photo store for the core V1.';

    const licensing = document.createElement('p');
    licensing.textContent =
      'Neural Brush original application code is MIT-licensed. MaleCNS source data and the derived connectome assets under public/data/male-cns-v1 retain the upstream CC BY 4.0 attribution and licensing requirements.';

    const links = document.createElement('p');
    links.className = 'about-dialog-links';
    const projectLink = document.createElement('a');
    projectLink.href = 'https://male-cns.janelia.org/';
    projectLink.target = '_blank';
    projectLink.rel = 'noreferrer';
    projectLink.textContent = 'MaleCNS project';
    const separator = document.createTextNode(' · ');
    const licenseLink = document.createElement('a');
    licenseLink.href = 'https://creativecommons.org/licenses/by/4.0/';
    licenseLink.target = '_blank';
    licenseLink.rel = 'noreferrer';
    licenseLink.textContent = 'CC BY 4.0';
    links.append(projectLink, separator, licenseLink);

    article.append(header, intro, model, art, privacy, licensing, links);
    dialog.append(article);
    host.append(trigger, dialog);

    trigger.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    this.trigger = trigger;
    this.dialog = dialog;
  }

  dispose(): void {
    this.dialog?.close();
    this.trigger?.remove();
    this.dialog?.remove();
    this.trigger = null;
    this.dialog = null;
  }
}
