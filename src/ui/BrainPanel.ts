import { APP_NAME } from '../app/constants';
import { AppState, type AppSnapshot } from '../app/AppState';
import type { CircuitGraph } from '../brain/CircuitGraph';
import { BrainRenderer } from '../brain/BrainRenderer';
import { NeuronInspector } from './NeuronInspector';

export interface BrainPanelControls {
  onPause(): void;
  onResume(): void;
  onReset(): void;
  onStimulate(bodyId: string, value: number): void;
  onInhibit(bodyId: string, value: number): void;
  onConnectionGain(edgeIndex: number, value: number): void;
}

function formatMetric(value: number): string {
  return value.toFixed(3);
}

function statusLabel(snapshot: AppSnapshot): string {
  switch (snapshot.brainStatus) {
    case 'idle':
      return 'MaleCNS circuit: not loaded';
    case 'loading':
      return 'MaleCNS circuit: loading circuit';
    case 'ready':
      return 'MaleCNS circuit: brain ready';
    case 'paused':
      return 'MaleCNS circuit: paused';
    case 'error':
      return 'MaleCNS circuit: error';
  }
}

export class BrainPanel {
  private unsubscribe: (() => void) | null = null;
  private graphHost: HTMLElement | null = null;
  private inspectorHost: HTMLElement | null = null;
  private circuit: CircuitGraph | null = null;
  private renderer: BrainRenderer | null = null;
  private inspector: NeuronInspector | null = null;

  constructor(
    private readonly state: AppState,
    private readonly controls: BrainPanelControls,
  ) {}

  mount(host: HTMLElement): void {
    this.unsubscribe?.();
    this.renderer?.dispose();
    this.renderer = null;
    this.inspector = null;

    const header = document.createElement('header');
    header.className = 'panel-header';

    const identity = document.createElement('div');
    const title = document.createElement('h1');
    title.textContent = APP_NAME;
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Brain';
    identity.append(title, subtitle);

    const controlsHost = document.createElement('div');
    controlsHost.className = 'brain-controls';

    const runButton = document.createElement('button');
    runButton.type = 'button';

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.textContent = 'Reset';

    controlsHost.append(runButton, resetButton);
    header.append(identity, controlsHost);

    const status = document.createElement('p');
    status.className = 'circuit-status';

    const error = document.createElement('p');
    error.className = 'brain-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    const metrics = document.createElement('div');
    metrics.className = 'brain-metrics';
    const metricElements = {
      turn: this.createMetric('Turn', 'brain-turn'),
      forward: this.createMetric('Forward', 'brain-forward'),
      dwell: this.createMetric('Dwell', 'brain-dwell'),
      arousal: this.createMetric('Arousal', 'brain-arousal'),
    };
    metrics.append(
      metricElements.turn.root,
      metricElements.forward.root,
      metricElements.dwell.root,
      metricElements.arousal.root,
    );

    const workspace = document.createElement('div');
    workspace.className = 'brain-workspace';

    const graphHost = document.createElement('div');
    graphHost.className = 'brain-graph-host';
    graphHost.setAttribute('aria-label', 'Brain graph workspace');
    graphHost.textContent = 'Waiting for MaleCNS circuit…';
    this.graphHost = graphHost;

    const inspectorHost = document.createElement('aside');
    inspectorHost.className = 'brain-inspector-host';
    inspectorHost.setAttribute('aria-label', 'Neuron inspector');
    this.inspectorHost = inspectorHost;

    workspace.append(graphHost, inspectorHost);
    host.replaceChildren(header, status, error, metrics, workspace);

    runButton.addEventListener('click', () => {
      const snapshot = this.state.getSnapshot();
      if (snapshot.brainStatus === 'ready') this.controls.onPause();
      else if (snapshot.brainStatus === 'paused') this.controls.onResume();
    });
    resetButton.addEventListener('click', () => this.controls.onReset());

    const render = (snapshot: AppSnapshot): void => {
      status.textContent = statusLabel(snapshot);
      error.textContent = snapshot.brainError ?? '';
      error.hidden = snapshot.brainError === null;

      runButton.textContent = snapshot.brainStatus === 'paused' ? 'Resume' : 'Pause';
      runButton.disabled = !['ready', 'paused'].includes(snapshot.brainStatus);
      resetButton.disabled = !['ready', 'paused'].includes(snapshot.brainStatus);

      metricElements.turn.value.textContent = formatMetric(snapshot.behavior.turn);
      metricElements.forward.value.textContent = formatMetric(snapshot.behavior.forward);
      metricElements.dwell.value.textContent = formatMetric(snapshot.behavior.dwell);
      metricElements.arousal.value.textContent = formatMetric(snapshot.behavior.arousal);

      const activation = snapshot.brainActivation;
      if (this.renderer && activation?.length === this.circuit?.metadata.neurons.length) {
        this.renderer.updateActivation(activation);
      }
    };

    render(this.state.getSnapshot());
    this.unsubscribe = this.state.subscribe(render);
    this.initializeGraph();
  }

  setCircuit(circuit: CircuitGraph): void {
    this.circuit = circuit;
    this.initializeGraph();
  }

  resetModulationControls(): void {
    this.inspector?.reset();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.inspector = null;
    this.graphHost = null;
    this.inspectorHost = null;
  }

  private initializeGraph(): void {
    if (!this.circuit || !this.graphHost || !this.inspectorHost) return;

    this.renderer?.dispose();
    const inspector = new NeuronInspector(
      this.circuit,
      {
        onStimulate: (bodyId, value) => this.controls.onStimulate(bodyId, value),
        onInhibit: (bodyId, value) => this.controls.onInhibit(bodyId, value),
        onConnectionGain: (edgeIndex, value) =>
          this.controls.onConnectionGain(edgeIndex, value),
      },
      (index) => this.renderer?.select(index),
    );
    inspector.mount(this.inspectorHost);

    const renderer = new BrainRenderer(this.graphHost, this.circuit, (index) => {
      inspector.selectNeuron(index);
    });
    renderer.select(0);
    const activation = this.state.getSnapshot().brainActivation;
    if (activation?.length === this.circuit.metadata.neurons.length) {
      renderer.updateActivation(activation);
    }

    this.inspector = inspector;
    this.renderer = renderer;
  }

  private createMetric(label: string, testId: string): { root: HTMLElement; value: HTMLElement } {
    const root = document.createElement('div');
    root.className = 'brain-metric';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('strong');
    value.dataset.testid = testId;
    value.textContent = '0.000';
    root.append(name, value);
    return { root, value };
  }
}
