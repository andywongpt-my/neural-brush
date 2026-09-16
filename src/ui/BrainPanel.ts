import { APP_NAME } from '../app/constants';
import { AppState, type AppSnapshot } from '../app/AppState';
import type { CircuitGraph } from '../brain/CircuitGraph';
import { BrainRenderCadence } from '../brain/BrainRenderCadence';
import { BrainRenderer } from '../brain/BrainRenderer';
import type { ModulationSnapshot } from '../brain/BrainRuntimeTypes';
import { NeuronInspector } from './NeuronInspector';
import { PresetControls } from './PresetControls';

const BRAIN_RENDER_HZ = 12;

export interface BrainPanelControls {
  onPause(): void;
  onResume(): void;
  onReset(): void;
  onRestart(): void;
  onStimulate(bodyId: string, value: number): void;
  onInhibit(bodyId: string, value: number): void;
  onConnectionGain(edgeIndex: number, value: number): void;
  onSharePreset(): string;
  onExportPreset(): void;
  onImportPreset(file: File): Promise<void>;
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

function cloneModulation(snapshot: ModulationSnapshot): ModulationSnapshot {
  return {
    stimulation: snapshot.stimulation.slice(),
    inhibition: snapshot.inhibition.slice(),
    connectionGain: snapshot.connectionGain.slice(),
  };
}

export class BrainPanel {
  private unsubscribe: (() => void) | null = null;
  private graphHost: HTMLElement | null = null;
  private inspectorHost: HTMLElement | null = null;
  private circuit: CircuitGraph | null = null;
  private renderer: BrainRenderer | null = null;
  private inspector: NeuronInspector | null = null;
  private presetControls: PresetControls | null = null;
  private mirroredModulation: ModulationSnapshot | null = null;
  private readonly brainRenderCadence = new BrainRenderCadence(BRAIN_RENDER_HZ);
  private lastRenderedActivationRevision = -1;
  private lastRenderedPresentationRevision = -1;

  constructor(
    private readonly state: AppState,
    private readonly controls: BrainPanelControls,
  ) {}

  mount(host: HTMLElement): void {
    this.unsubscribe?.();
    this.renderer?.dispose();
    this.renderer = null;
    this.inspector = null;
    this.presetControls = null;
    this.brainRenderCadence.reset();
    this.lastRenderedActivationRevision = -1;
    this.lastRenderedPresentationRevision = -1;

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

    const restartButton = document.createElement('button');
    restartButton.type = 'button';
    restartButton.textContent = 'Restart Brain';
    restartButton.hidden = true;

    controlsHost.append(runButton, resetButton, restartButton);
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

    const presetHost = document.createElement('div');
    presetHost.className = 'preset-controls-host';
    const presetControls = new PresetControls({
      onShare: () => this.controls.onSharePreset(),
      onExport: () => this.controls.onExportPreset(),
      onImport: (file) => this.controls.onImportPreset(file),
      onReset: () => this.controls.onReset(),
    });
    presetControls.mount(presetHost);
    this.presetControls = presetControls;

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
    host.replaceChildren(header, status, error, metrics, presetHost, workspace);

    runButton.addEventListener('click', () => {
      const snapshot = this.state.getSnapshot();
      if (snapshot.brainStatus === 'ready') this.controls.onPause();
      else if (snapshot.brainStatus === 'paused') this.controls.onResume();
    });
    resetButton.addEventListener('click', () => this.controls.onReset());
    restartButton.addEventListener('click', () => this.controls.onRestart());

    const render = (snapshot: AppSnapshot): void => {
      if (
        snapshot.brainPresentationRevision !==
        this.lastRenderedPresentationRevision
      ) {
        status.textContent = statusLabel(snapshot);
        error.textContent = snapshot.brainError ?? '';
        error.hidden = snapshot.brainError === null;

        runButton.textContent =
          snapshot.brainStatus === 'paused' ? 'Resume' : 'Pause';
        runButton.disabled = !['ready', 'paused'].includes(snapshot.brainStatus);
        resetButton.disabled = !['ready', 'paused'].includes(snapshot.brainStatus);
        restartButton.hidden = snapshot.brainStatus !== 'error';
        restartButton.disabled = snapshot.brainStatus !== 'error';

        metricElements.turn.value.textContent = formatMetric(snapshot.behavior.turn);
        metricElements.forward.value.textContent = formatMetric(snapshot.behavior.forward);
        metricElements.dwell.value.textContent = formatMetric(snapshot.behavior.dwell);
        metricElements.arousal.value.textContent = formatMetric(snapshot.behavior.arousal);
        this.lastRenderedPresentationRevision =
          snapshot.brainPresentationRevision;
      }

      const activation = snapshot.brainActivation;
      if (
        this.renderer &&
        activation !== null &&
        activation.length === this.circuit?.metadata.neurons.length &&
        snapshot.brainActivationRevision !== this.lastRenderedActivationRevision &&
        this.brainRenderCadence.shouldRender(performance.now())
      ) {
        this.renderer.updateActivation(activation);
        this.lastRenderedActivationRevision = snapshot.brainActivationRevision;
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

  syncModulationControls(snapshot: ModulationSnapshot): void {
    this.mirroredModulation = cloneModulation(snapshot);
    this.inspector?.syncModulation(this.mirroredModulation);
  }

  showPresetWarning(message: string): void {
    this.presetControls?.showWarning(message);
  }

  resetModulationControls(): void {
    this.mirroredModulation = null;
    this.inspector?.reset();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.inspector = null;
    this.presetControls = null;
    this.graphHost = null;
    this.inspectorHost = null;
    this.mirroredModulation = null;
    this.brainRenderCadence.reset();
    this.lastRenderedActivationRevision = -1;
    this.lastRenderedPresentationRevision = -1;
  }

  private initializeGraph(): void {
    if (!this.circuit || !this.graphHost || !this.inspectorHost) return;

    this.renderer?.dispose();
    this.brainRenderCadence.reset();
    this.lastRenderedActivationRevision = -1;
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
    if (this.mirroredModulation) {
      inspector.syncModulation(this.mirroredModulation);
    }

    const renderer = new BrainRenderer(this.graphHost, this.circuit, (index) => {
      inspector.selectNeuron(index);
    });
    renderer.select(0);
    const snapshot = this.state.getSnapshot();
    const activation = snapshot.brainActivation;
    if (activation?.length === this.circuit.metadata.neurons.length) {
      renderer.updateActivation(activation);
      this.lastRenderedActivationRevision = snapshot.brainActivationRevision;
      this.brainRenderCadence.shouldRender(performance.now());
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
