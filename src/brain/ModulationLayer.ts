const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function assertCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function assertIndex(name: string, index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError(`${name} index ${index} is outside 0..${length - 1}`);
  }
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

export interface ModulationSnapshot {
  stimulation: Float32Array;
  inhibition: Float32Array;
  connectionGain: Float32Array;
}

export class ModulationLayer {
  private readonly stimulationState: Float32Array;
  private readonly inhibitionState: Float32Array;
  private readonly connectionGainState: Float32Array;

  constructor(neuronCount: number, edgeCount: number) {
    assertCount('neuronCount', neuronCount);
    assertCount('edgeCount', edgeCount);

    this.stimulationState = new Float32Array(neuronCount);
    this.inhibitionState = new Float32Array(neuronCount);
    this.connectionGainState = new Float32Array(edgeCount);
    this.connectionGainState.fill(1);
  }

  get stimulation(): Float32Array {
    return this.stimulationState.slice();
  }

  get inhibition(): Float32Array {
    return this.inhibitionState.slice();
  }

  get connectionGain(): Float32Array {
    return this.connectionGainState.slice();
  }

  setStimulation(index: number, value: number): void {
    assertIndex('stimulation', index, this.stimulationState.length);
    assertFinite('stimulation', value);
    this.stimulationState[index] = clamp(value, 0, 1);
  }

  setInhibition(index: number, value: number): void {
    assertIndex('inhibition', index, this.inhibitionState.length);
    assertFinite('inhibition', value);
    this.inhibitionState[index] = clamp(value, 0, 1);
  }

  setConnectionGain(edgeIndex: number, value: number): void {
    assertIndex('connectionGain', edgeIndex, this.connectionGainState.length);
    assertFinite('connectionGain', value);
    this.connectionGainState[edgeIndex] = clamp(value, 0, 2);
  }

  reset(): void {
    this.stimulationState.fill(0);
    this.inhibitionState.fill(0);
    this.connectionGainState.fill(1);
  }

  snapshot(): ModulationSnapshot {
    return {
      stimulation: this.stimulationState.slice(),
      inhibition: this.inhibitionState.slice(),
      connectionGain: this.connectionGainState.slice(),
    };
  }
}
