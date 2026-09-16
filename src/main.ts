import './styles.css';
import { NeuralBrushApp } from './app/NeuralBrushApp';

type NeuralBrushTestWindow = Window & {
  __NEURAL_BRUSH_TEST__?: {
    editedChecksum(): number | null;
    fly(): { x: number; y: number };
    photoClientPoint(x: number, y: number): { x: number; y: number } | null;
  };
};

const host = document.querySelector<HTMLElement>('#app');

if (!host) {
  throw new Error('Neural Brush could not find the #app host element.');
}

const app = new NeuralBrushApp(host);
app.mount();

if (import.meta.env.DEV) {
  const testWindow = window as NeuralBrushTestWindow;
  testWindow.__NEURAL_BRUSH_TEST__ = {
    editedChecksum: () => app.getEditedChecksum(),
    fly: () => {
      const fly = app.getFlyState();
      return { x: fly.x, y: fly.y };
    },
    photoClientPoint: (x, y) => app.getPhotoClientPoint(x, y),
  };
}
