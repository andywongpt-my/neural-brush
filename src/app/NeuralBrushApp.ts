import { AppError } from './AppError';
import { AppState } from './AppState';
import { BrainWorkerClient } from '../brain/BrainWorkerClient';
import { CircuitLoader } from '../brain/CircuitLoader';
import type { CircuitGraph } from '../brain/CircuitGraph';
import { toEngineGraph } from '../brain/EngineGraphAdapter';
import { ModulationLayer } from '../brain/ModulationLayer';
import type { EngineGraph } from '../brain/BrainRuntimeTypes';
import { FlyController } from '../fly/FlyController';
import { LocalVision } from '../vision/LocalVision';
import { SensoryAdapter } from '../vision/SensoryAdapter';
import { BrainPanel } from '../ui/BrainPanel';
import { CanvasPanel, type VisionFrame } from '../ui/CanvasPanel';
import { ErrorBanner } from '../ui/ErrorBanner';
import { SplitView } from '../ui/SplitView';

const DEFAULT_BRAIN_SEED = 0x4e425631; // "NBV1"
const VISION_RADIUS_PX = 8;
const MAX_FRAME_DT_SECONDS = 0.05;

export class NeuralBrushApp {
  private readonly state = new AppState();
  private readonly brainPanel = new BrainPanel(this.state, {
    onPause: () => this.pauseBrain(),
    onResume: () => this.resumeBrain(),
    onReset: () => this.resetBrain(),
  });
  private readonly canvasPanel = new CanvasPanel(this.state, (frame) => {
    this.visionFrame = frame;
  });
  private circuit: CircuitGraph | null = null;
  private engineGraph: EngineGraph | null = null;
  private modulation: ModulationLayer | null = null;
  private brainWorker: BrainWorkerClient | null = null;
  private flyController = new FlyController();
  private visionFrame: VisionFrame | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTimeMs: number | null = null;
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

  resetBrain(): void {
    if (!this.brainWorker || !this.modulation) return;
    this.modulation.reset();
    this.brainWorker.reset();
    this.brainWorker.setModulation(this.modulation.snapshot());
    this.flyController = new FlyController();
    this.state.resetRuntime();
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
      const dtSeconds =
        previousTime === null
          ? 0
          : Math.min(MAX_FRAME_DT_SECONDS, Math.max(0, (timeMs - previousTime) / 1000));

      const snapshot = this.state.getSnapshot();
      if (snapshot.brainStatus === 'ready') {
        this.sendLocalSensory(snapshot.fly.x, snapshot.fly.y);
        if (dtSeconds > 0) {
          this.state.setFly(
            this.flyController.step(snapshot.behavior, dtSeconds),
          );
        }
      }

      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  private sendLocalSensory(x: number, y: number): void {
    if (!this.visionFrame || !this.engineGraph || !this.brainWorker) return;

    const sample = LocalVision.sample(
      this.visionFrame.pixels,
      this.visionFrame.width,
      this.visionFrame.height,
      x,
      y,
      VISION_RADIUS_PX,
    );
    const drive = SensoryAdapter.map(
      sample,
      this.engineGraph.inputPorts,
      this.engineGraph.nodeCount,
    );
    this.brainWorker.sendSensory(drive);
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
