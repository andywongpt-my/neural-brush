import './styles.css';
import { NeuralBrushApp } from './app/NeuralBrushApp';

const host = document.querySelector<HTMLElement>('#app');

if (!host) {
  throw new Error('Neural Brush could not find the #app host element.');
}

new NeuralBrushApp(host).mount();
