import { AppError } from './AppError';
import { AppState } from './AppState';
import { BrainWorkerClient } from '../brain/BrainWorkerClient';
import { CircuitLoader } from '../brain/CircuitLoader';
import type { CircuitGraph } from '../brain/CircuitGraph';
import { toEngineGraph } from '../brain/EngineGraphAdapter';
import { ModulationLayer } from '../brain/ModulationLayer';
import type { EngineGraph } from '../brain/BrainRuntimeTypes';
import { mapFlyToBrush } from '../brush/BrushBehaviorMap';
import type { BrushMode } from '../brush/BrushTypes';
import { FlyController } from '../fly/FlyController';
import type { FlyState } from '../fly/FlyTypes';
import { FrameStats, type FrameSummary } from '../perf/FrameStats';
import {
  sampleEditedPatch,
  type ImageDataLike,
} from '../vision/EditedImageSampler';
import { SensoryAdapter } from '../vision/SensoryAdapter';
import { SensoryCadence } from '../vision/SensoryCadence';
import { BrainPanel } from '../ui/BrainPanel';
import { CanvasPanel } from '../ui/CanvasPanel';
import { ErrorBanner } from '../ui/ErrorBanner';
import { SplitView } from '../ui/SplitView';

const DEFAULT_BRAIN_SEED = 0x4e425631; // "NBV1"
const VISION_RADIUS_PX = 8;
const MAX_FRAME_DT_SECONDS = 0.05;
const SENSORY_RATE_HZ = 30;
const MIN_DRAG_DT_SECONDS = 1 / 240;
const DEBUG_UPDATE_MS = 250;

interface DebugElements {
  root: HTMLElement;
  average: HTMLElement;
  p95: HTMLElement;
  fly: HTMLElement;
}

export class NeuralBrushApp {
  private readonly state = new AppState();
  private readonly frameStats = new FrameStats();
  private readonly brainPanel = new BrainPanel(this.state, {
    onPause: () => this.pauseBrain(),
    onResume: () => this.resumeBrain(),
    onReset: () => this.resetBrain(),
    onStimulate: (bodyId, value) => this.stimulateNeuron(bodyId, value),
    onInhibit: (bodyId, value) => this.inhibitNeuron(bodyId, value),
    onConnectionGain: (edgeIndex, value) => this.setConnectionGain(edgeIndex, value),
  });
  private readonly sensoryCadence = new SensoryCadence(SENSORY_RATE_HZ);
  private readonly canvasPanel = new CanvasPanel(
    this.state,
    {
      getFlyState: () => this.flyController.state,
      onDragStart: (x, y) => this.beginFlyDrag(x, y),
      onDrag: (x, y) => this.dragFly(x, y),
      onDragEnd: () => this.endFlyDrag(),
      onFollowTarget: (x, y) => this.flyController.setFollowTarget(x, y),
      onAutonomous: () => this.flyController.clearFollowTarget(),
    },
    () => this.resetSensoryFeedback(),
  );
  private circuit: CircuitGraph | null = null;
  private engineGraph: EngineGraph | null = null;
  private modulation: ModulationLayer | null = null;
  private brainWorker: BrainWorkerClient | null = null;
  private flyController = new FlyController();
  private previousEditedPatch: ImageDataLike | null = null;
  private brushMode: BrushMode = 'blend';
  private animationFrameId: number | null = null;
  private lastFrameTimeMs: number | null = null;
  private lastDragTimeMs: number | null = null;
  private debugElements: DebugElements | null = null;
  private lastDebugUpdateMs = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {}

  mount(): void {
    try {
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
      this.mountDebugPanel();
      this.startAnimationLoop();
      void this.initializeBrain();
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : new AppError('APP_INIT', cause);
      new ErrorBanner(this.host).show(appError);
    }
  }

  stimulateNeuron(bodyId: string, value: number): void {
    const index = this.requireNeuronIndex(bodyId);
    const { modulation, worker } = this.requireBrainRuntime();
    modulation.setStimulation(index, value);
    worker.setModulation(modulation.snapshot());
  }

  inhibitNeuron(bodyId: string, value: number): void {
    const index = this.requireNeuronIndex(bodyId);
    const { modulation, worker } = this.requireBrainRuntime();
    modulation.setInhibition(index, value);
    worker.setModulation(modulation.snapshot());
  }

  setConnectionGain(edgeIndex: number, value: number): void {
    const { modulation, worker } = this.requireBrainRuntime();
    modulation.setConnectionGain(edgeIndex, value);
    worker.setModulation(modulation.snapshot());
  }

  setBrushMode(mode: BrushMode): void {
    this.brushMode = mode;
  }

  getEditedChecksum(): number | null {
    return this.canvasPanel.editedChecksum();
  }

  getFlyState(): FlyState {
    return this.flyController.state;
  }

  getPhotoClientPoint(
    xNorm: number,
    yNorm: number,
  ): { x: number; y: number } | null {
    return this.canvasPanel.photoClientPoint(xNorm, yNorm);
  }

  getFrameSummary(): FrameSummary {
    return this.frameStats.summary;
  }

  resetBrain(): void {
    if (!this.brainWorker || !this.modulation) return;
    this.modulation.reset();
    this.brainWorker.reset();
    this.brainWorker.setModulation(this.modulation.snapshot());
    this.brainPanel.resetModulationControls();
    this.flyController = new FlyController();
    this.state.resetRuntime();
    this.canvasPanel.updateFly(this.flyController.state);
    this.resetSensoryFeedback();
    this.state.setBrainStatus('ready');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.brainWorker?.dispose();
    this.brainWorker = null;
    this.brainPanel.dispose();
    this.canvasPanel.dispose();
    this.debugElements?.root.remove();
    this.debugElements = null;
  }

  private async initializeBrain(): Promise<void> {
    this.state.clearBrainError();
    this.state.setBrainStatus('loading');

    try {
      const circuit = await CircuitLoader.load(
        `${import.meta.env.BASE_URL}data/male-cns-v1/`,
      );
      if (this.disposed) return;

      const engineGraph = toEngineGraph(circuit);
      const modulation = new ModulationLayer(
        engineGraph.nodeCount,
        engineGraph.weight.length,
      );
      const worker = new BrainWorkerClient();

      worker.onReady(() => {
        if (this.disposed) return;
        this.state.clearBrainError();
        this.state.setBrainStatus('ready');
      });
      worker.onState(({ activation, behavior }) => {
        if (this.disposed) return;
        this.state.setBrainActivation(activation);
        this.state.setBehavior(behavior);
      });
      worker.onError(({ message }) => {
        if (this.disposed) return;
        this.state.setBrainError(message);
      });

      this.circuit = circuit;
      this.engineGraph = engineGraph;
      this.modulation = modulation;
      this.brainWorker = worker;
      this.brainPanel.setCircuit(circuit);
      worker.init(engineGraph, DEFAULT_BRAIN_SEED);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      this.state.setBrainError(`Unable to start neural runtime: ${message}`);
    }
  }

  private startAnimationLoop(): void {
    const frame = (timeMs: number): void => {
      if (this.disposed) return;

      const previousTime = this.lastFrameTimeMs;
      this.lastFrameTimeMs = timeMs;
      if (previousTime !== null) {
        const frameDurationMs = Math.max(0, timeMs - previousTime);
        this.frameStats.record(frameDurationMs);
      }
      const dtSeconds =
        previousTime === null
          ? 0
          : Math.min(MAX_FRAME_DT_SECONDS, Math.max(0, (timeMs - previousTime) / 1000));

      const snapshot = this.state.getSnapshot();
      if (snapshot.brainStatus === 'ready') {
        let fly = this.flyController.state;
        if (dtSeconds > 0) {
          fly = this.flyController.step(snapshot.behavior, dtSeconds);
          this.state.setFly(fly);
        }
        this.canvasPanel.updateFly(fly);

        if (snapshot.imageName !== null) {
          const brushFrame = mapFlyToBrush(fly, snapshot.behavior, this.brushMode);
          this.canvasPanel.applyBrush(brushFrame, this.brushMode);

          if (this.sensoryCadence.shouldSample(timeMs)) {
            this.sendEditedSensory(fly.x, fly.y);
          }
        }
      }

      this.updateDebugPanel(timeMs);
      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  private sendEditedSensory(x: number, y: number): void {
    if (!this.engineGraph || !this.brainWorker) return;

    const patch = this.canvasPanel.readEditedPatch(x, y, VISION_RADIUS_PX);
    if (!patch) return;

    const previous =
      this.previousEditedPatch &&
      this.previousEditedPatch.width === patch.width &&
      this.previousEditedPatch.height === patch.height
        ? this.previousEditedPatch
        : undefined;
    const sample = sampleEditedPatch(patch, previous);
    const drive = SensoryAdapter.map(
      sample,
      this.engineGraph.inputPorts,
      this.engineGraph.nodeCount,
    );
    this.previousEditedPatch = patch;
    this.brainWorker.sendSensory(drive);
  }

  private beginFlyDrag(x: number, y: number): void {
    this.lastDragTimeMs = performance.now();
    const fly = this.flyController.beginDrag(x, y);
    this.state.setFly(fly);
    this.canvasPanel.updateFly(fly);
  }

  private dragFly(x: number, y: number): void {
    const now = performance.now();
    const previous = this.lastDragTimeMs ?? now;
    const dtSeconds = Math.max(MIN_DRAG_DT_SECONDS, (now - previous) / 1000);
    this.lastDragTimeMs = now;
    const fly = this.flyController.dragTo(x, y, dtSeconds);
    this.state.setFly(fly);
    this.canvasPanel.updateFly(fly);
  }

  private endFlyDrag(): void {
    this.flyController.endDrag();
    this.lastDragTimeMs = null;
  }

  private resetSensoryFeedback(): void {
    this.previousEditedPatch = null;
    this.sensoryCadence.reset();
  }

  private pauseBrain(): void {
    if (!this.brainWorker) return;
    this.brainWorker.pause();
    this.state.setBrainStatus('paused');
  }

  private resumeBrain(): void {
    if (!this.brainWorker) return;
    this.brainWorker.resume();
    this.lastFrameTimeMs = null;
    this.state.setBrainStatus('ready');
  }

  private mountDebugPanel(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') !== '1') return;

    const root = document.createElement('aside');
    root.className = 'performance-debug';
    root.setAttribute('aria-label', 'Performance diagnostics');

    const title = document.createElement('strong');
    title.textContent = 'Local performance';
    const average = this.debugValue('Avg frame', 'debug-frame-average', '0.00');
    const p95 = this.debugValue('P95 frame', 'debug-frame-p95', '0.00');
    const fly = this.debugValue('Fly x,y', 'debug-fly-position', '0.500,0.500');
    root.append(title, average.row, p95.row, fly.row);
    this.host.append(root);
    this.debugElements = {
      root,
      average: average.value,
      p95: p95.value,
      fly: fly.value,
    };
  }

  private updateDebugPanel(timeMs: number): void {
    if (!this.debugElements || timeMs - this.lastDebugUpdateMs < DEBUG_UPDATE_MS) {
      return;
    }
    this.lastDebugUpdateMs = timeMs;
    const summary = this.frameStats.summary;
    const fly = this.flyController.state;
    this.debugElements.average.textContent = summary.averageMs.toFixed(2);
    this.debugElements.p95.textContent = summary.p95Ms.toFixed(2);
    this.debugElements.fly.textContent = `${fly.x.toFixed(3)},${fly.y.toFixed(3)}`;
  }

  private debugValue(
    labelText: string,
    testId: string,
    initial: string,
  ): { row: HTMLElement; value: HTMLElement } {
    const row = document.createElement('span');
    const label = document.createElement('span');
    label.textContent = labelText;
    const value = document.createElement('output');
    value.dataset.testid = testId;
    value.textContent = initial;
    row.append(label, value);
    return { row, value };
  }

  private requireNeuronIndex(bodyId: string): number {
    if (!this.circuit) {
      throw new Error('MaleCNS circuit is not loaded');
    }
    const index = this.circuit.indexByBodyId.get(bodyId);
    if (index === undefined) {
      throw new RangeError(`Unknown MaleCNS body ID: ${bodyId}`);
    }
    return index;
  }

  private requireBrainRuntime(): {
    modulation: ModulationLayer;
    worker: BrainWorkerClient;
  } {
    if (!this.modulation || !this.brainWorker) {
      throw new Error('Neural runtime is not ready');
    }
    return { modulation: this.modulation, worker: this.brainWorker };
  }
}
