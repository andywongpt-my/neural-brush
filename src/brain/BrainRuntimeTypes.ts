export interface EngineGraph {
  nodeCount: number;
  source: Uint32Array;
  target: Uint32Array;
  weight: Uint32Array;
  inputPorts: Uint32Array;
  turnLeftPorts: Uint32Array;
  turnRightPorts: Uint32Array;
  forwardPorts: Uint32Array;
}

export interface BehaviorState {
  turn: number;
  forward: number;
  dwell: number;
  arousal: number;
}

export interface ModulationSnapshot {
  stimulation: Float32Array;
  inhibition: Float32Array;
  connectionGain: Float32Array;
}

export interface BrainStepResult {
  activation: Float32Array;
  behavior: BehaviorState;
}
