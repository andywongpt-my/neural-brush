import { APP_NAME } from '../app/constants';

export class BrainPanel {
  mount(host: HTMLElement): void {
    const header = document.createElement('header');
    header.className = 'panel-header';

    const identity = document.createElement('div');
    const title = document.createElement('h1');
    title.textContent = APP_NAME;
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Brain';
    identity.append(title, subtitle);

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.disabled = true;
    runButton.textContent = 'Run';

    header.append(identity, runButton);

    const status = document.createElement('p');
    status.className = 'circuit-status';
    status.textContent = 'MaleCNS circuit: not loaded';

    const graphHost = document.createElement('div');
    graphHost.className = 'brain-graph-host';
    graphHost.setAttribute('aria-label', 'Brain graph workspace');
    graphHost.textContent = 'Neural activity will appear here.';

    host.replaceChildren(header, status, graphHost);
  }
}
