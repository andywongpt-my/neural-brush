# Neural Brush Live Three.js Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the live MaleCNS-derived Brain and fly while applying Smear, Saturation, and Glow directly to the photo in real time with a true edited-image sensory feedback loop.

**Architecture:** Keep source photo texture immutable. `BrushPipeline` owns two same-size ping-pong render targets and applies localized full-screen shader passes around the fly; the current target is displayed by `CanvasRenderer`. The fly is rendered as a separate overlay so final image export can exclude it. A second Three.js renderer, `BrainRenderer`, uses instanced nodes and batched line geometry and observes worker state without owning simulation state.

**Tech Stack:** Three.js `WebGLRenderer`, `WebGLRenderTarget`, `ShaderMaterial`, `InstancedMesh`, `BufferGeometry`, TypeScript, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-15-neural-brush-design.md`

## Global Constraints

- Brush effects are artistic mappings from fly behavior; they are not biological motor outputs.
- V1 effects are exactly Smear, Saturation, Glow, plus an optional Blend combination.
- Brain/source photo/simulation data boundaries remain explicit.
- Rendering target is approximately 60 FPS on a typical modern desktop under normal V1 circuit size.
- Do not allocate one Three.js Mesh per neuron or one Line object per edge.
- No unbounded per-frame object creation.
- The next local sensory sample must read the **edited** image, not the original source image.
- Direct dragging overrides fly position only while active and returns control to the neural controller on release.

---

### Task 1: Define pure Brain-to-Brush parameter mapping

**Files:**
- Create: `src/brush/BrushTypes.ts`
- Create: `src/brush/BrushBehaviorMap.ts`
- Create: `tests/unit/BrushBehaviorMap.test.ts`

**Interfaces:**
- Produces:

```ts
export type BrushMode = 'smear' | 'saturation' | 'glow' | 'blend';
export interface BrushFrame {
  centerX: number;
  centerY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  smear: number;
  saturation: number;
  glow: number;
}
```

- Produces: `mapFlyToBrush(fly, behavior, mode): BrushFrame` with every strength clamped to `0..1`.

- [ ] **Step 1: Write failing mapping tests**

Tests must assert:

```ts
it('increases smear when fly speed increases', () => { /* fast.smear > slow.smear */ });
it('increases saturation when dwell increases', () => { /* high dwell > low dwell */ });
it('increases glow when arousal increases', () => { /* high arousal > low */ });
it('sets non-selected effects to zero outside blend mode', () => { /* smear mode */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run tests/unit/BrushBehaviorMap.test.ts`

Expected: FAIL because mapping does not exist.

- [ ] **Step 3: Implement exact V1 mapping**

Use normalized fly speed `speed01 = clamp01(fly.speed / 0.45)` and:

```ts
const smear = clamp01(0.15 + speed01 * 0.85);
const saturation = clamp01(behavior.dwell * (0.35 + 0.65 * behavior.arousal));
const glow = clamp01(behavior.arousal * (0.35 + 0.65 * speed01));
const radius = 0.025 + 0.045 * (0.5 * behavior.arousal + 0.5 * behavior.dwell);
```

Velocity is the latest normalized fly displacement divided by logical frame duration and then bounded to magnitude `1` for shader use.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- --run tests/unit/BrushBehaviorMap.test.ts`

Expected: PASS.

```bash
git add src/brush tests/unit/BrushBehaviorMap.test.ts

git commit -m "feat: map fly behavior to artistic brush parameters"
```

---

### Task 2: Implement ping-pong render targets and Smear/Saturation/Glow shader passes

**Files:**
- Create: `src/brush/BrushPipeline.ts`
- Create: `src/brush/FullscreenPass.ts`
- Create: `src/brush/SmearPass.ts`
- Create: `src/brush/SaturationPass.ts`
- Create: `src/brush/GlowPass.ts`
- Create: `src/brush/shaders/common.glsl.ts`
- Create: `tests/unit/BrushPipelineState.test.ts`
- Modify: `src/render/CanvasRenderer.ts`

**Interfaces:**
- `BrushPipeline.initialize(source: THREE.Texture, width: number, height: number): void`.
- `BrushPipeline.apply(frame: BrushFrame, mode: BrushMode): void`.
- `BrushPipeline.texture: THREE.Texture` returns current edited texture.
- `BrushPipeline.currentTarget: THREE.WebGLRenderTarget` supports local pixel readback.
- `BrushPipeline.reset(): void` copies immutable source texture back to edit target.
- `BrushPipeline.dispose(): void` disposes render targets/materials.

- [ ] **Step 1: Write failing state/ownership tests**

Use small fake/disposable Three objects where possible and assert that `reset()` preserves the original source reference, ping/pong indices alternate after a pass, and `dispose()` is idempotent.

- [ ] **Step 2: Implement a reusable full-screen pass**

Create one orthographic full-screen scene with a plane geometry. Each effect owns only a `ShaderMaterial`; `FullscreenPass.render(material,inputTexture,outputTarget)` swaps the material on the shared quad and renders with `renderer.setRenderTarget(outputTarget)`.

- [ ] **Step 3: Implement localized circular mask shared by all shaders**

GLSL helper:

```glsl
float brushMask(vec2 uv, vec2 center, float radius) {
  float d = distance(uv, center);
  return 1.0 - smoothstep(radius * 0.65, radius, d);
}
```

Every pass must return the original sampled pixel when the mask is zero.

- [ ] **Step 4: Implement Smear shader**

Within the mask, sample source at:

```glsl
vec2 offset = normalize(uVelocity + vec2(1e-6)) * uStrength * uRadius * 0.75;
vec4 dragged = texture2D(uInput, clamp(vUv - offset, 0.0, 1.0));
color = mix(base, dragged, mask * uStrength);
```

If velocity magnitude is below `0.001`, use base color unchanged to avoid random normalization artifacts.

- [ ] **Step 5: Implement Saturation shader**

Compute Rec.709 luminance and:

```glsl
vec3 saturated = mix(vec3(luma), base.rgb, 1.0 + 1.5 * uStrength);
color.rgb = mix(base.rgb, saturated, mask * uStrength);
```

Clamp final RGB to `0..1`.

- [ ] **Step 6: Implement Glow shader**

Sample eight neighboring taps at `uRadius * 0.15`; average them, then locally add a bounded brightening:

```glsl
vec3 halo = max(blurred - base.rgb * 0.5, vec3(0.0));
vec3 glowing = clamp(base.rgb + halo * (0.8 * uStrength) + vec3(0.08 * uStrength), 0.0, 1.0);
color.rgb = mix(base.rgb, glowing, mask * uStrength);
```

- [ ] **Step 7: Implement pass ordering and ping-pong ownership**

For `blend`, apply in exact order: Smear -> Saturation -> Glow, swapping targets after each pass. For a single mode, apply one pass. Ensure the read and write target are never the same.

- [ ] **Step 8: Display edited texture through `CanvasRenderer` and run gates**

The photo plane material must reference `BrushPipeline.texture` after each apply. Resize must recreate targets while preserving the current edited image where feasible; loading a new source reinitializes the pipeline.

Run:

```bash
npm test -- --run tests/unit/BrushPipelineState.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/brush src/render tests/unit/BrushPipelineState.test.ts

git commit -m "feat: add live Smear Saturation and Glow pipeline"
```

---

### Task 3: Feed edited render-target pixels back into `LocalVision`

**Files:**
- Modify: `src/render/CanvasRenderer.ts`
- Create: `src/vision/EditedImageSampler.ts`
- Create: `tests/unit/EditedImageSampler.test.ts`
- Modify: `src/app/NeuralBrushApp.ts`

**Interfaces:**
- Produces: `CanvasRenderer.readEditedPatch(xNorm, yNorm, radiusPx): ImageDataLike` where `ImageDataLike = { data: Uint8ClampedArray; width: number; height: number }`.
- Maximum readback patch is `32 x 32` pixels per sensory update.
- Sensory readback runs at 30 Hz, not every render frame.

- [ ] **Step 1: Write failing coordinate conversion tests**

Test normalized center/edge coordinates and the WebGL bottom-left Y origin conversion. Ensure x/y/radius are clamped and output dimensions never exceed 32x32.

- [ ] **Step 2: Implement readback rectangle calculation**

Convert normalized fly coordinates to render-target pixel coordinates, clamp the rectangle, and call `renderer.readRenderTargetPixels(currentTarget, x, y, width, height, Uint8Array)`.

Flip rows into top-left image order before constructing the `Uint8ClampedArray` used by `LocalVision`.

- [ ] **Step 3: Replace source-image sampling with edited-image sampling**

In `NeuralBrushApp`, the 30 Hz sensory scheduler must read the current edited patch and pass it to `LocalVision`. Preserve the previous sample to calculate motion.

- [ ] **Step 4: Add integration proof of feedback**

Create `tests/integration/FeedbackLoop.test.ts` with a small deterministic software fixture path where an edit changes local pixels and the next `SensorySample` differs. Browser E2E later confirms the GPU path.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- --run tests/unit/EditedImageSampler.test.ts tests/integration/FeedbackLoop.test.ts
npm run build
```

Expected: PASS.

```bash
git add src tests

git commit -m "feat: feed edited image back into fly vision"
```

---

### Task 4: Render the fly as a separate interactive Three.js overlay

**Files:**
- Create: `src/fly/FlyRenderer.ts`
- Create: `src/fly/FlyPointerInteraction.ts`
- Modify: `src/render/CanvasRenderer.ts`
- Modify: `src/ui/CanvasPanel.ts`
- Create: `tests/unit/FlyPointerInteraction.test.ts`

**Interfaces:**
- `FlyRenderer.update(state: FlyState): void`.
- Fly is rendered after the photo plane and is not part of `BrushPipeline.currentTarget`.
- `FlyPointerInteraction` exposes callbacks `onDragStart`, `onDrag`, `onDragEnd`, `onFollowTarget` using normalized photo coordinates.

- [ ] **Step 1: Write failing pointer-priority tests**

Test that pointer-down within the fly hit radius starts dragging, pointer-down elsewhere sets follow target, drag coordinates clamp to `0..1`, and pointer-up ends drag.

- [ ] **Step 2: Implement a procedural fly sprite**

Generate a small `CanvasTexture` at startup using 2D canvas shapes: dark elliptical body, head, two translucent wings. Do not load an external asset in V1. Use a `THREE.Sprite` so screen-facing orientation is stable.

- [ ] **Step 3: Map normalized fly coordinates to the photo plane**

`FlyRenderer` positions the sprite in the same coordinate frame as the fitted photo plane and scales it relative to photo size, not viewport size.

- [ ] **Step 4: Wire pointer controls to `FlyController`**

Use Pointer Events and pointer capture. Dragging has highest priority. A click/tap outside the fly sets follow target. Provide a visible `Autonomous` button that clears follow target and returns to brain-only control.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run tests/unit/FlyPointerInteraction.test.ts && npm run typecheck`

Expected: PASS.

```bash
git add src/fly src/render src/ui tests/unit/FlyPointerInteraction.test.ts

git commit -m "feat: render and directly control the live fly"
```

---

### Task 5: Render the live Brain graph efficiently and add modulation inspector controls

**Files:**
- Create: `src/brain/BrainLayout.ts`
- Create: `src/brain/BrainRenderer.ts`
- Modify: `src/ui/BrainPanel.ts`
- Create: `src/ui/NeuronInspector.ts`
- Create: `tests/unit/BrainLayout.test.ts`

**Interfaces:**
- `BrainLayout.compute(graph): Float32Array` returns `x,y,z` per neuron.
- `BrainRenderer` uses one `InstancedMesh` for nodes and one `LineSegments` object for all edges.
- `BrainRenderer.updateActivation(activation: Float32Array): void` updates instance scale/color buffers without rebuilding graph geometry.
- `NeuronInspector` modifies only `ModulationLayer` through app callbacks.

- [ ] **Step 1: Write deterministic layout tests**

Input ports must be placed in the left band, descending seeds/behavior ports in the right band, and other nodes in deterministic middle columns ordered by numeric body ID. Re-running with equal metadata must return equal positions.

- [ ] **Step 2: Implement deterministic layered layout**

Use x bands:

- input ports: `x = -1`,
- interior: columns across `-0.6 .. 0.6`, assigned by stable index modulo four columns,
- descending/forward/turn ports: `x = 1`.

Within each band, distribute y evenly `-0.9 .. 0.9`. Slight z offsets by group avoid z-fighting only; do not imply biological physical coordinates.

- [ ] **Step 3: Implement batched Brain renderer**

Create one low-poly circle/sphere geometry `InstancedMesh` for nodes. Build one `BufferGeometry` with two vertices per edge for `LineSegments`. Maintain bodyId->instanceIndex mapping for selection. Do not create per-node meshes or per-edge Line objects.

- [ ] **Step 4: Show source facts separately from live state**

`NeuronInspector` displays read-only dataset/body ID/type/instance/soma side/neurotransmitter. Editable controls are separate sliders:

- Stimulation `0..1`, step `0.01`.
- Inhibition `0..1`, step `0.01`.
- Selected connection gain `0..2`, step `0.01`.

UI labels must call gain **modulation** and retain/display raw source weight separately.

- [ ] **Step 5: Wire activity visualization**

On each 30 Hz worker state message, update node scale from `0.75 + activation * 0.5`. Update a per-instance color/attribute to distinguish low/high activity. Edge geometry is static; selected edge and user gain may be shown by a separate single highlight line, not by rebuilding all edges.

- [ ] **Step 6: Add reset and pause/resume controls**

Reset clears stimulation/inhibition/gain to neutral and resets worker state; pause stops neural stepping while preserving current image. Neither control resets the image unless user separately chooses `Reset Image`.

- [ ] **Step 7: Run tests/build and commit**

Run:

```bash
npm test -- --run tests/unit/BrainLayout.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

```bash
git add src/brain src/ui tests/unit/BrainLayout.test.ts

git commit -m "feat: render live Brain and modulation controls"
```

---

### Task 6: Integrate the 60 FPS render loop and browser smoke test

**Files:**
- Modify: `src/app/NeuralBrushApp.ts`
- Modify: `src/render/CanvasRenderer.ts`
- Modify: `tests/e2e/app.spec.ts`
- Create: `src/perf/FrameStats.ts`
- Create: `tests/unit/FrameStats.test.ts`

**Interfaces:**
- Render loop: `requestAnimationFrame`.
- Neural state reception: 30 Hz worker messages.
- Sensory readback: 30 Hz.
- Brush application: at most once per rendered frame when image + fly are active.
- `FrameStats` records rolling render frame duration without telemetry/network calls.

- [ ] **Step 1: Add browser smoke flow**

Playwright flow:

1. load fixture image,
2. wait for `brain ready`,
3. click `Run`,
4. capture initial canvas data URL via a test-only exported helper,
5. wait 1 second,
6. capture edited image checksum/data URL and assert it differs,
7. adjust a neuron stimulation slider,
8. assert displayed behavior values update,
9. drag fly and assert its displayed normalized position changes.

- [ ] **Step 2: Implement single-owned animation lifecycle**

`NeuralBrushApp` starts one RAF loop on mount and cancels it on dispose. Store the RAF ID; never recursively create a second loop after image reload or reset.

- [ ] **Step 3: Implement rolling local performance diagnostics**

`FrameStats` keeps the last 120 frame durations in a fixed-size circular buffer and exposes average/p95. It does not transmit data. Add a development-only small diagnostic readout behind `?debug=1`.

- [ ] **Step 4: Run complete quality gate**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

Expected: all PASS.

- [ ] **Step 5: Manual performance check**

In current desktop Chrome/Edge with the real V1 circuit and a ~1920x1080 image, run for 60 seconds. Record average/p95 frame times in the implementation PR description. Target average near or below 16.7 ms; if p95 repeatedly exceeds 33 ms, profile before proceeding to Plan 5.

- [ ] **Step 6: Commit**

```bash
git add src tests

git commit -m "feat: complete live neural brush feedback loop"
```

---

## Plan 4 Completion Gate

Before Plan 5:

- The fly visibly edits the loaded photo live.
- Smear responds to speed/direction, Saturation to dwell/arousal, Glow to arousal/speed.
- Edited pixels feed the next 30 Hz sensory sample.
- Direct drag/follow and autonomous modes work.
- Brain graph is live, batched, and distinct from biological source metadata controls.
- Modulating a neuron/edge changes behavior without altering source topology/weights.
- Final edit texture does not contain the fly overlay.
- Browser smoke test and 60-second manual performance check pass.
