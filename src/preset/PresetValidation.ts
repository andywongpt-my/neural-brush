import type { CircuitGraph } from '../brain/CircuitGraph';
import type { ModulationLayer } from '../brain/ModulationLayer';
import type { BrushMode } from '../brush/BrushTypes';
import {
  BRUSH_MODES,
  PRESET_CIRCUIT,
  PRESET_DATASET,
  PRESET_SCHEMA_VERSION,
  UINT32_MAX,
  type BrainPresetNeuronModulation,
  type BrainPresetV1,
} from './BrainPreset';

export class PresetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetValidationError';
  }
}

const BODY_ID_PATTERN = /^\d+$/;
const EDGE_KEY_PATTERN = /^(\d+)>(\d+)$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(message: string): never {
  throw new PresetValidationError(message);
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be a finite number`);
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function brushMode(value: unknown): BrushMode {
  if (typeof value !== 'string' || !BRUSH_MODES.includes(value as BrushMode)) {
    fail('brush must be one of smear, saturation, glow, or blend');
  }
  return value as BrushMode;
}

function edgeKeyMap(graph: CircuitGraph): Map<string, number> {
  const result = new Map<string, number>();
  graph.edges.forEach((edge, edgeIndex) => {
    const source = graph.metadata.neurons[edge.sourceIndex]?.bodyId;
    const target = graph.metadata.neurons[edge.targetIndex]?.bodyId;
    if (!source || !target) {
      throw new Error(`Circuit edge ${edgeIndex} references an unknown neuron index`);
    }
    result.set(`${source}>${target}`, edgeIndex);
  });
  return result;
}

function normalizedFloat(value: number): number {
  return Number(value.toFixed(6));
}

function validateNeuronModulation(
  bodyId: string,
  input: unknown,
): BrainPresetNeuronModulation {
  if (!isPlainObject(input)) fail(`modulation for ${bodyId} must be an object`);

  const allowed = new Set(['stimulation', 'inhibition']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) fail(`unknown modulation field: ${key}`);
  }

  const output: BrainPresetNeuronModulation = {};
  if ('stimulation' in input) {
    output.stimulation = clamp(
      finiteNumber(input.stimulation, `stimulation for ${bodyId}`),
      0,
      1,
    );
  }
  if ('inhibition' in input) {
    output.inhibition = clamp(
      finiteNumber(input.inhibition, `inhibition for ${bodyId}`),
      0,
      1,
    );
  }

  return output;
}

export function validatePreset(input: unknown, graph: CircuitGraph): BrainPresetV1 {
  if (!isPlainObject(input)) fail('preset must be a plain object');

  const allowedTopLevel = new Set([
    'schema',
    'dataset',
    'circuit',
    'seed',
    'brush',
    'modulation',
    'gains',
  ]);
  for (const key of Object.keys(input)) {
    if (!allowedTopLevel.has(key)) fail(`unknown preset field: ${key}`);
  }

  if (input.schema !== PRESET_SCHEMA_VERSION) fail('unsupported preset schema');
  if (input.dataset !== PRESET_DATASET) fail('preset dataset does not match MaleCNS v1.0');
  if (input.circuit !== PRESET_CIRCUIT) fail('preset circuit does not match dna-steering-v1');

  const seed = finiteNumber(input.seed, 'seed');
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    fail('seed must be an unsigned 32-bit integer');
  }

  const brush = brushMode(input.brush);
  if (!isPlainObject(input.modulation)) fail('modulation must be an object');
  if (!isPlainObject(input.gains)) fail('gains must be an object');

  const modulationEntries = Object.entries(input.modulation);
  if (modulationEntries.length > graph.metadata.neurons.length) {
    fail('preset contains more modulation entries than loaded neurons');
  }

  const modulation: Record<string, BrainPresetNeuronModulation> = {};
  for (const [bodyId, value] of modulationEntries) {
    if (!BODY_ID_PATTERN.test(bodyId)) fail(`invalid body ID: ${bodyId}`);
    if (!graph.indexByBodyId.has(bodyId)) fail(`unknown body ID: ${bodyId}`);
    modulation[bodyId] = validateNeuronModulation(bodyId, value);
  }

  const knownEdges = edgeKeyMap(graph);
  const gainEntries = Object.entries(input.gains);
  if (gainEntries.length > graph.edges.length) {
    fail('preset contains more gain entries than loaded edges');
  }

  const gains: Record<string, number> = {};
  for (const [key, value] of gainEntries) {
    if (!EDGE_KEY_PATTERN.test(key)) fail(`invalid edge key: ${key}`);
    if (!knownEdges.has(key)) fail(`unknown edge key: ${key}`);
    gains[key] = clamp(finiteNumber(value, `gain for ${key}`), 0, 2);
  }

  return {
    schema: PRESET_SCHEMA_VERSION,
    dataset: PRESET_DATASET,
    circuit: PRESET_CIRCUIT,
    seed,
    brush,
    modulation,
    gains,
  };
}

export function presetFromState(
  graph: CircuitGraph,
  modulationLayer: ModulationLayer,
  brush: BrushMode,
  seed: number,
): BrainPresetV1 {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  if (!BRUSH_MODES.includes(brush)) {
    throw new RangeError('unsupported brush mode');
  }

  const snapshot = modulationLayer.snapshot();
  if (
    snapshot.stimulation.length !== graph.metadata.neurons.length ||
    snapshot.inhibition.length !== graph.metadata.neurons.length ||
    snapshot.connectionGain.length !== graph.edges.length
  ) {
    throw new RangeError('modulation layer dimensions do not match circuit graph');
  }

  const modulation: Record<string, BrainPresetNeuronModulation> = {};
  graph.metadata.neurons.forEach((neuron, index) => {
    const stimulation = normalizedFloat(snapshot.stimulation[index] ?? 0);
    const inhibition = normalizedFloat(snapshot.inhibition[index] ?? 0);
    const entry: BrainPresetNeuronModulation = {};
    if (stimulation > 0) entry.stimulation = stimulation;
    if (inhibition > 0) entry.inhibition = inhibition;
    if (Object.keys(entry).length > 0) modulation[neuron.bodyId] = entry;
  });

  const gains: Record<string, number> = {};
  graph.edges.forEach((edge, edgeIndex) => {
    const gain = normalizedFloat(snapshot.connectionGain[edgeIndex] ?? 1);
    if (gain === 1) return;
    const source = graph.metadata.neurons[edge.sourceIndex]?.bodyId;
    const target = graph.metadata.neurons[edge.targetIndex]?.bodyId;
    if (!source || !target) {
      throw new Error(`Circuit edge ${edgeIndex} references an unknown neuron index`);
    }
    gains[`${source}>${target}`] = gain;
  });

  return {
    schema: PRESET_SCHEMA_VERSION,
    dataset: PRESET_DATASET,
    circuit: PRESET_CIRCUIT,
    seed,
    brush,
    modulation,
    gains,
  };
}

export function applyPresetToModulation(
  preset: BrainPresetV1,
  graph: CircuitGraph,
  modulationLayer: ModulationLayer,
): void {
  const normalized = validatePreset(preset, graph);
  const edges = edgeKeyMap(graph);

  modulationLayer.reset();

  for (const [bodyId, values] of Object.entries(normalized.modulation)) {
    const index = graph.indexByBodyId.get(bodyId);
    if (index === undefined) throw new PresetValidationError(`unknown body ID: ${bodyId}`);
    if (values.stimulation !== undefined) {
      modulationLayer.setStimulation(index, values.stimulation);
    }
    if (values.inhibition !== undefined) {
      modulationLayer.setInhibition(index, values.inhibition);
    }
  }

  for (const [key, gain] of Object.entries(normalized.gains)) {
    const edgeIndex = edges.get(key);
    if (edgeIndex === undefined) throw new PresetValidationError(`unknown edge key: ${key}`);
    modulationLayer.setConnectionGain(edgeIndex, gain);
  }
}
