# Neural Brush Neural Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, Web Worker-based connectome-constrained neural simulation that converts local photo features into fly behavior without mutating MaleCNS source data.

**Architecture:** The main thread loads immutable `CircuitGraph` data, creates a separate `ModulationLayer`, and copies compact typed arrays into a dedicated worker. The worker runs `BrainEngine` at a fixed logical timestep and returns activation plus behavior readouts. `LocalVision`/`SensoryAdapter` generate synthetic external drives; `FlyController` converts behavior readouts to normalized fly movement.

**Tech Stack:** TypeScript, Web Workers, Float32Array/Uint32Array, Vitest, Three.js integration points only

**Spec:** `docs/superpowers/specs/2026-09-15-neural-brush-design.md`

## Global Constraints

- Source topology, weights, body IDs, annotations, and neurotransmitter predictions remain immutable/read-only.
- User connection gain is bounded to exactly **0.0x–2.0x**.
- Neural simulation runs off the main thread, target 60 Hz within the approved 30–120 Hz range.
- Same circuit + preset/modulation + sensory input stream + random seed must produce the same simulation output.
- Dynamics are simplified modeling assumptions, not claimed electrophysiology.
- Brain outputs behavior-level values only: turn, forward, dwell, arousal.
- Local photo feature injection is synthetic external stimulation and must remain separable from MaleCNS source facts.

---

### Task 1: Implement immutable modulation state and deterministic PRNG

**Files:**
- Create: `src/brain/ModulationLayer.ts`
- Create: `src/brain/SeededRandom.ts`
- Create: `tests/unit/ModulationLayer.test.ts`
- Create: `tests/unit/SeededRandom.test.ts`

**Interfaces:**
- Produces: `ModulationLayer(neuronCount: number, edgeCount: number)`.
- Produces: `setStimulation(index, value)`, `setInhibition(index, value)`, `setConnectionGain(edgeIndex, value)`, `reset()`.
- Exposes copies/readonly views: `stimulation`, `inhibition`, `connectionGain`.
- Produces: `SeededRandom.next(): number` in `[0,1)` using a fixed xorshift32 algorithm.

- [ ] **Step 1: Write failing modulation bound tests**

```ts
import { describe, expect, it } from 'vitest';
import { ModulationLayer } from '../../src/brain/ModulationLayer';

describe('ModulationLayer', () => {
  it('clamps neuron modulation to 0..1 and edge gain to 0..2', () => {
    const m = new ModulationLayer(2, 1);
    m.setStimulation(0, 2);
    m.setInhibition(1, -1);
    m.setConnectionGain(0, 5);
    expect(m.stimulation[0]).toBe(1);
    expect(m.inhibition[1]).toBe(0);
    expect(m.connectionGain[0]).toBe(2);
  });

  it('resets to neutral without touching source graph data', () => {
    const m = new ModulationLayer(1, 1);
    m.setStimulation(0, 0.5);
    m.setConnectionGain(0, 0.2);
    m.reset();
    expect([...m.stimulation]).toEqual([0]);
    expect([...m.inhibition]).toEqual([0]);
    expect([...m.connectionGain]).toEqual([1]);
  });
});
```

- [ ] **Step 2: Write failing seeded-random reproducibility test**

```ts
import { SeededRandom } from '../../src/brain/SeededRandom';

it('repeats the same sequence for the same seed', () => {
  const a = new SeededRandom(12345);
  const b = new SeededRandom(12345);
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- --run tests/unit/ModulationLayer.test.ts tests/unit/SeededRandom.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement minimal deterministic classes**

`ModulationLayer` stores typed arrays and rejects out-of-range indices with `RangeError`. Neutral connection gain is `1.0`.

Use this exact PRNG transition:

```ts
export class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = (seed >>> 0) || 0x6d2b79f5; }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run tests/unit/ModulationLayer.test.ts tests/unit/SeededRandom.test.ts`

Expected: PASS.

```bash
git add src/brain tests/unit

git commit -m "feat: add deterministic brain modulation state"
```

---

### Task 2: Implement deterministic `BrainEngine` dynamics and behavior readout

**Files:**
- Create: `src/brain/BrainEngine.ts`
- Create: `src/brain/BrainRuntimeTypes.ts`
- Create: `tests/unit/BrainEngine.test.ts`

**Interfaces:**
- Produces:

```ts
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
  turn: number;    // -1 left .. +1 right
  forward: number; // 0..1
  dwell: number;   // 0..1
  arousal: number; // 0..1
}
```

- Produces: `BrainEngine.step(dtMs: number, externalDrive: Float32Array, modulation: ModulationSnapshot): BrainStepResult`.
- `BrainStepResult.activation` length equals node count.

- [ ] **Step 1: Write failing determinism and readout tests**

Create a four-node fixture with two directed edges and explicit left/right/forward ports. Tests must assert:

```ts
it('produces byte-for-byte equal activations with the same seed and inputs', () => { /* two engines */ });
it('connection gain zero prevents that edge from propagating', () => { /* compare target */ });
it('positive right activity yields positive turn', () => { /* turn > 0 */ });
it('dwell is exactly clamp01(1 - forward)', () => { /* equality */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run tests/unit/BrainEngine.test.ts`

Expected: FAIL because `BrainEngine` does not exist.

- [ ] **Step 3: Implement exact edge normalization and update equation**

Use:

```ts
const normalizeWeight = (weight: number) => Math.tanh(Math.log1p(weight) / 4);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
```

For each step:

1. `incoming.fill(0)`.
2. For each edge `e`, add `activation[source[e]] * normalizeWeight(weight[e]) * gain[e]` to target incoming.
3. Add `externalDrive[i] + stimulation[i] * 0.75 - inhibition[i] * 0.75`.
4. `targetActivation = sigmoid(incoming[i] - 0.5)`.
5. `alpha = Math.min(1, Math.max(0, dtMs / 80))`.
6. deterministic noise = `(rng.next() - 0.5) * 0.01`.
7. `activation[i] = clamp01(activation[i] + (targetActivation - activation[i]) * alpha + noise)`.

Behavior readout:

```ts
turn = clamp(mean(turnRightPorts) - mean(turnLeftPorts), -1, 1);
forward = clamp01(mean(forwardPorts));
dwell = clamp01(1 - forward);
arousal = clamp01(mean(all node activations));
```

If a required behavior port array is empty, constructor throws instead of guessing.

- [ ] **Step 4: Prove source weights are never mutated**

Add a test that snapshots `graph.weight`, runs 100 steps with modulation, and expects the original `Uint32Array` values to be unchanged.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run tests/unit/BrainEngine.test.ts`

Expected: PASS.

```bash
git add src/brain tests/unit/BrainEngine.test.ts

git commit -m "feat: add deterministic connectome-constrained dynamics"
```

---

### Task 3: Move `BrainEngine` into a fixed-rate Web Worker

**Files:**
- Create: `src/brain/BrainProtocol.ts`
- Create: `src/brain/BrainWorker.ts`
- Create: `src/brain/BrainWorkerClient.ts`
- Create: `tests/unit/BrainProtocol.test.ts`

**Interfaces:**
- Main -> worker messages: `init`, `sensory`, `modulation`, `pause`, `resume`, `reset`, `dispose`.
- Worker -> main messages: `ready`, `state`, `error`.
- Worker logical timestep: `1000 / 60` ms.
- State publish rate: 30 Hz; internal simulation rate remains 60 Hz.

- [ ] **Step 1: Write a failing protocol discriminant test**

```ts
import { describe, expect, it } from 'vitest';
import { isWorkerCommand } from '../../src/brain/BrainProtocol';

it('rejects unknown command types', () => {
  expect(isWorkerCommand({ type: 'rewire-everything' })).toBe(false);
});
```

- [ ] **Step 2: Implement serializable protocol types and guards**

`init` includes copied typed arrays, port arrays, node/edge counts, and seed. `sensory` includes a `Float32Array` whose length equals node count. `modulation` carries stimulation/inhibition/gain typed arrays and is range-validated in the worker before replacing active modulation.

- [ ] **Step 3: Implement worker fixed-step loop**

Use `setInterval` with `STEP_MS = 1000 / 60`; measure elapsed wall time only for diagnostics, not to vary deterministic logical `dtMs`. Publish every second internal step (30 Hz). On `pause`, stop stepping without clearing state. On `reset`, reset activation, PRNG seed, and neutral modulation.

- [ ] **Step 4: Implement `BrainWorkerClient` lifecycle**

Create worker with:

```ts
new Worker(new URL('./BrainWorker.ts', import.meta.url), { type: 'module' });
```

Expose `init`, `sendSensory`, `setModulation`, `pause`, `resume`, `reset`, `dispose`, and `onState(callback)`. `dispose` terminates the worker and prevents later method calls.

- [ ] **Step 5: Run protocol tests, typecheck, build, commit**

Run:

```bash
npm test -- --run tests/unit/BrainProtocol.test.ts tests/unit/BrainEngine.test.ts
npm run typecheck
npm run build
```

Expected: PASS and Vite emits the worker chunk.

```bash
git add src/brain tests/unit

git commit -m "feat: run neural simulation in Web Worker"
```

---

### Task 4: Implement local visual feature sampling and synthetic sensory mapping

**Files:**
- Create: `src/vision/LocalVision.ts`
- Create: `src/vision/SensoryAdapter.ts`
- Create: `src/vision/AIVisionAdapter.ts`
- Create: `tests/unit/LocalVision.test.ts`
- Create: `tests/unit/SensoryAdapter.test.ts`

**Interfaces:**
- Produces:

```ts
export interface SensorySample {
  luminance: number;
  saturation: number;
  contrast: number;
  edge: number;
  motion: number;
}
```

- `LocalVision.sample(pixels, width, height, xNorm, yNorm, radiusPx, previous?): SensorySample`.
- `SensoryAdapter.map(sample, inputPortIndices, nodeCount): Float32Array`.
- `AIVisionAdapter` is an interface only in V1 static mode; default implementation returns no semantic modulation.

- [ ] **Step 1: Write failing feature tests using tiny synthetic images**

Tests must verify:

- uniform black patch luminance `0`, contrast `0`, edge `0`,
- uniform white patch luminance near `1`,
- red/green checkerboard has greater edge/contrast than a uniform patch,
- identical current/previous patches have motion `0`.

- [ ] **Step 2: Implement bounded local feature extraction**

Sample a square patch centered on normalized fly coordinates, clamp bounds, compute Rec.709 luminance `(0.2126*r + 0.7152*g + 0.0722*b)/255`, saturation from `(max-min)/max` with zero guard, standard-deviation contrast normalized to `0..1`, simple horizontal/vertical finite-difference edge magnitude, and mean absolute luminance delta for motion. Clamp every output to `0..1`.

- [ ] **Step 3: Write failing sensory-mapping determinism test**

For each input port ordinal `k`, assign one feature by `k % 5` in the exact order `[luminance, saturation, contrast, edge, motion]`. Test that the same sample and ports always produce the same node-length drive array and non-input nodes remain zero.

- [ ] **Step 4: Implement `SensoryAdapter` and AI extension interface**

`SensoryAdapter.map` writes feature values only at input-port indices. `AIVisionAdapter` defines an async `analyze(ImageBitmap): Promise<SemanticMaskSet | null>` contract, but the default static implementation returns `null` and performs no network request.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- --run tests/unit/LocalVision.test.ts tests/unit/SensoryAdapter.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add src/vision tests/unit

git commit -m "feat: add local visual sensory adapter"
```

---

### Task 5: Implement normalized fly physics and control modes

**Files:**
- Create: `src/fly/FlyPhysics.ts`
- Create: `src/fly/FlyController.ts`
- Create: `src/fly/FlyTypes.ts`
- Create: `tests/unit/FlyPhysics.test.ts`
- Create: `tests/unit/FlyController.test.ts`

**Interfaces:**
- Fly coordinates are normalized `x,y` in `0..1`; heading is radians.
- `FlyPhysics.step(state, behavior, dtSeconds): FlyState`.
- `FlyController` modes: `autonomous`, `followTarget`, `dragging`.
- Direct drag position wins while dragging; releasing returns to autonomous unless a follow target is still active.

- [ ] **Step 1: Write failing physics tests**

Tests assert:

- positive `turn` increases heading,
- forward `1` moves farther than forward `0`,
- dwell `1` reduces movement,
- positions remain in `0..1` by reflective boundary handling,
- equal initial state + behavior + dt gives equal next state.

- [ ] **Step 2: Implement exact movement equation**

Use:

```ts
const turnRate = 2.4; // rad/s at |turn|=1
const minSpeed = 0.02;
const maxSpeed = 0.45;
heading += behavior.turn * turnRate * dt;
const targetSpeed = (minSpeed + behavior.forward * (maxSpeed - minSpeed)) * (1 - 0.8 * behavior.dwell);
speed += (targetSpeed - speed) * Math.min(1, dt * 8);
x += Math.cos(heading) * speed * dt;
y += Math.sin(heading) * speed * dt;
```

Reflect at each `0/1` boundary and mirror heading so the fly remains inside the photo.

- [ ] **Step 3: Implement controller mode priority**

Priority is `dragging > followTarget > autonomous`. Follow-target steering calculates desired heading to pointer target and applies a bounded turn command while preserving neural forward/dwell/arousal values. Dragging sets x/y directly and computes velocity from pointer deltas for later brush effects.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- --run tests/unit/FlyPhysics.test.ts tests/unit/FlyController.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add src/fly tests/unit

git commit -m "feat: add live fly behavior controller"
```

---

### Task 6: Integrate circuit loader, worker, sensory adapter, and fly state into app orchestration

**Files:**
- Modify: `src/app/NeuralBrushApp.ts`
- Modify: `src/app/AppState.ts`
- Modify: `src/ui/BrainPanel.ts`
- Create: `tests/integration/NeuralLoop.test.ts`

**Interfaces:**
- `AppState` stores latest read-only `BehaviorState`, fly state, worker status, and error status.
- `NeuralBrushApp` owns lifecycle: load circuit -> init worker -> send sensory -> receive behavior -> step fly.
- Rendering remains observational; it must not own or mutate simulation state.

- [ ] **Step 1: Write an integration test for the full CPU-side loop**

Use a fixture graph/image and assert:

```text
image sample -> SensoryAdapter -> BrainEngine -> BehaviorState -> FlyPhysics -> changed fly position
```

Repeat with identical seed and inputs and assert equal final state after 120 logical steps.

- [ ] **Step 2: Implement app lifecycle and status text**

On app start, load circuit and initialize worker. Brain panel status transitions: `loading circuit` -> `brain ready` or a user-safe error. When an image is available, the app schedules sensory sampling; until Plan 4 provides GPU readback, use the source image pixels as the initial local-vision provider.

- [ ] **Step 3: Add modulation hooks but no final controls yet**

Expose app methods `stimulateNeuron(bodyId,value)`, `inhibitNeuron(bodyId,value)`, `setConnectionGain(edgeIndex,value)`, and `resetBrain()` that update `ModulationLayer` then send a snapshot to the worker. Brain UI wiring happens in Plan 4.

- [ ] **Step 4: Run full gates**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests/integration

git commit -m "feat: integrate neural sensory and fly runtime"
```

---

## Plan 3 Completion Gate

Before Plan 4:

- Worker simulation is deterministic for the same seed and logical input stream.
- Raw MaleCNS edge weights remain unchanged after modulation and simulation.
- Connection gain is enforced at 0..2.
- Sensory features are local, bounded, deterministic, and explicitly synthetic inputs.
- Behavior state contains only turn/forward/dwell/arousal.
- Fly moves autonomously and supports follow/drag control modes.
- Main thread owns UI/rendering; neural stepping occurs in a worker.
