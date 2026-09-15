import './styles.css';
import { APP_NAME } from './app/constants';

const host = document.querySelector<HTMLElement>('#app');

if (!host) {
  throw new Error('Neural Brush could not find the #app host element.');
}

host.setAttribute('aria-label', APP_NAME);
host.textContent = APP_NAME;
