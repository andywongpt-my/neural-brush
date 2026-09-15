import { AppError } from '../app/AppError';

export class ErrorBanner {
  constructor(private readonly host: HTMLElement) {}

  show(error: AppError): void {
    const banner = document.createElement('div');
    banner.className = 'app-error-banner';
    banner.setAttribute('role', 'alert');

    const title = document.createElement('strong');
    title.textContent = 'Neural Brush error';

    const message = document.createElement('p');
    message.textContent = error.message;

    banner.append(title, message);
    this.host.replaceChildren(banner);
  }
}
