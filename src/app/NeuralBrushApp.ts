import { AppState } from './AppState';
import { BrainPanel } from '../ui/BrainPanel';
import { CanvasPanel } from '../ui/CanvasPanel';
import { SplitView } from '../ui/SplitView';

export class NeuralBrushApp {
  private readonly state = new AppState();
  private readonly brainPanel = new BrainPanel();
  private readonly canvasPanel = new CanvasPanel(this.state);

  constructor(private readonly host: HTMLElement) {}

  mount(): void {
    const splitView = new SplitView({
      initialRatio: this.state.getSnapshot().splitRatio,
      onRatioChange: (ratio) => {
        this.state.setSplitRatio(ratio);
        splitView.setRatio(this.state.getSnapshot().splitRatio);
      },
    });

    const { brainHost, canvasHost } = splitView.mount(this.host);
    this.brainPanel.mount(brainHost);
    this.canvasPanel.mount(canvasHost);
  }
}
