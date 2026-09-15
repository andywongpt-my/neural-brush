# Neural Brush — V1 Design Specification

**Status:** Approved  
**Date:** 2026-09-15  
**Project:** Neural Brush  
**Primary deployment:** GitHub Pages  
**Primary stack:** TypeScript + Vite + Three.js + Web Workers + WebGL

## 1. Product Definition

Neural Brush is an open-source browser-based creative photo editor in which a live fruit fly edits a user-supplied image while a MaleCNS-derived neural circuit is visualized alongside it.

The signature interaction is:

1. The user loads a photo.
2. A fly moves live over the photo.
3. The fly continuously modifies pixels using artistic brush effects.
4. A Brain panel shows neural activity in real time.
5. The user can stimulate or inhibit neurons and scale existing connection strengths.
6. Those neural-state changes immediately alter fly behavior.
7. The changed fly behavior changes where and how the photo is edited.
8. The user exports the result or shares a Brain Preset so another person can apply the same modulated brain to another image.

The product must preserve the causal chain:

`photo features -> sensory adapter -> MaleCNS-derived neural subgraph -> fly behavior -> artistic brush -> changed photo -> new visual input`

The edited photo feeds back into the next sensory input. Neural Brush is not a prerecorded animation.

## 2. Product Positioning

Neural Brush is primarily a **creative photo-editing tool** combining practical image manipulation, artistic effects, live autonomous behavior, connectome-derived interaction, scientific transparency, and shareable deterministic brain presets.

It is not marketed as a complete biological simulation of Drosophila neural activity.

## 3. Core UI: Brain First, Split View

Desktop V1 uses a persistent split view.

### Left: Brain panel

The Brain panel is the primary control surface and should occupy approximately 58% of the initial desktop workspace. It displays selected MaleCNS-derived neurons, directed connectivity, connection activity, neuron activation, selected-neuron metadata, stimulation/inhibition controls, per-connection gain, simulation status, and behavior readouts.

The separator between Brain and Canvas should be draggable.

### Right: Live photo canvas

The Canvas occupies approximately 42% initially and displays the user photo, live fly, current trajectory, live brush effects, effect strengths, direct-manipulation controls, and export state.

Both sides remain visible during normal desktop editing.

### Responsive behavior

V1 is desktop-complete. Narrow screens may stack or simplify the Brain view, but mobile must at minimum support image upload, live fly editing, preset loading, basic brain modulation, and final export. Desktop remains the reference experience for the complete neural graph interaction.

## 4. Live Fly Interaction

### 4.1 Autonomous mode

When the user is not dragging the fly, movement is driven by the current neural simulation. The neural layer outputs behavior-level variables such as left/right turning tendency, forward drive / movement speed, dwell / stop tendency, and global arousal/activity state.

The Brain never directly outputs “Smear 70%” or “Glow 40%.”

### 4.2 Direct manipulation

The user can move a pointer/touch target and let the fly follow, or directly grab and drag the fly for precise local editing. When direct manipulation ends, control returns to the neural simulation.

Direct control is an editing affordance; it does not modify biological topology.

## 5. V1 Brush Effects

V1 ships exactly three primary artistic effects.

### 5.1 Smear

- Higher movement speed increases smear length.
- Direction and turning determine smear direction.
- Rapid turns bend or redirect the smear.

### 5.2 Saturation

- Longer dwell increases local color enhancement.
- Arousal modulates effect intensity.

### 5.3 Glow

- Higher aggregate neural activity increases glow intensity.
- Movement speed influences light-trail length.

A combined Blend mode may apply all three using bounded weights. These mappings are explicitly an artistic layer and are not claimed to be biological motor outputs.

## 6. MaleCNS Scientific Model

### 6.1 Source

V1 uses data derived from the public `male-cns:v1.0` connectome. Upstream data includes segment-to-segment connectivity, neuron annotations, neurotransmitter predictions, and skeleton data.

The complete MaleCNS connection-weight table is approximately 1.1 GB, so the browser must not download or simulate the complete graph.

### 6.2 Compact circuit extraction

An offline preprocessing tool creates a compact versioned circuit for Neural Brush, for example:

- `public/data/male-cns-v1/circuit.bin`
- `public/data/male-cns-v1/metadata.json`

The extracted circuit initially targets a small, behaviorally relevant subset of visual/intermediate/descending circuitry. The architecture must support later circuit expansion without changing application-facing interfaces.

### 6.3 Preserved biological facts

The following are immutable/read-only in the app:

- body IDs,
- neuron type/identity,
- source dataset version,
- directed topology,
- source connection weights,
- source annotations,
- source neurotransmitter predictions.

### 6.4 User modulation

Users may alter only a separate modulation layer.

Allowed:

- neuron stimulation,
- neuron inhibition,
- connection gain,
- reset to baseline,
- save/load modulation presets.

Connection gain is bounded to **0.0x–2.0x** in V1.

`effective_weight = source_weight * user_gain`

The source weight remains intact and inspectable.

Not allowed in V1:

- inventing fake MaleCNS neurons,
- arbitrary rewiring,
- changing body IDs,
- changing biological source metadata,
- replacing source topology with user topology.

## 7. Neural Dynamics

V1 uses **connectome-constrained simplified dynamics**. It preserves real graph structure and connection weights while using an intentionally simplified real-time state model.

A neuron state may include current activation, accumulated input, decay, threshold/nonlinearity, bounded stochastic noise, user stimulation, and user inhibition.

The simulator must be deterministic when given the same circuit version, Brain Preset, photo-derived input stream, and random seed.

The system must not claim that these simplified dynamics reconstruct real electrophysiology.

### Timing

- Neural simulation: 30–120 Hz in a Web Worker.
- Fly physics/behavior: 60 Hz logical update target.
- Three.js rendering: `requestAnimationFrame`.

The main thread must remain responsive while the neural worker runs.

## 8. Visual Input

### 8.1 Default local visual system

By default, photo processing happens entirely in the browser. The fly samples only a local retinal-like patch around its current position.

Local signals include luminance, color channels, saturation, local contrast, edge strength, and motion/change caused by fly movement and editing.

A `SensoryAdapter` converts these image measurements into bounded simulation inputs. This adapter must be documented as a modeling interface between image pixels and the selected MaleCNS-derived circuit.

### 8.2 Feedback loop

After the fly edits the image, the next sensory sample reads the edited pixels. Therefore the fly changes the image, the image changes future sensory input, future brain activity changes, and the fly may alter its path.

This feedback loop is a required V1 property.

## 9. Optional AI Vision

AI Vision is a hybrid extension point, not a requirement for the static GitHub Pages V1 to remain fully functional.

Potential semantic masks include face, sky, vegetation, foreground object, and other coarse regions. These masks are treated as **external synthetic modulation signals** such as attraction, avoidance, or attention bias and must never be presented as native MaleCNS sensory pathways.

### V1 security rule

The GitHub Pages build must contain no secret service API key. V1 may define `AIVisionAdapter` interfaces and mock/local providers. A later backend or user-supplied endpoint can implement remote semantic vision.

## 10. Brain Panel

### 10.1 Read-only biological identity

For each selected neuron/connection, display when available: dataset, body ID, type/instance, source weight, direction, annotations, neurotransmitter prediction, and circuit membership.

### 10.2 Editable state

Users may manipulate stimulation, inhibition, connection gain, simulation pause/resume, and reset to baseline.

### 10.3 Activity visualization

The graph should display active neurons, relative activation, active directed edges, selected connections, and behavior readouts.

The visualization must distinguish:

1. source biological data,
2. current simulated state,
3. user modulation,
4. artistic brush behavior.

## 11. Brain -> Fly -> Brush Boundary

The Brain outputs behavior-level state: turn left/right, forward drive, dwell, and arousal.

The brush system consumes fly state: speed -> smear length, turn curvature -> smear direction, dwell -> local saturation, arousal -> glow intensity.

The UI and documentation must not imply that MaleCNS contains a “Glow neuron” or “Smear motor neuron.”

## 12. Presets and Sharing

### 12.1 Preset contents

A Brain Preset contains no user photo. It may contain schema version, MaleCNS dataset version, Neural Brush circuit version, neuron stimulation values, neuron inhibition values, connection gain overrides, brush mode, bounded brush settings, and deterministic random seed.

Example conceptual structure:

```json
{
  "schema": 1,
  "dataset": "male-cns:v1.0",
  "circuit": "visual-v1",
  "seed": 12345,
  "modulation": {
    "194965": {"stim": 0.22},
    "194966": {"inhibit": 0.18}
  },
  "gains": {
    "194965>194966": 1.28
  },
  "brush": "blend"
}
```

IDs above are illustrative only unless verified in the final selected circuit.

### 12.2 URL sharing

V1 should encode compact presets in a URL fragment:

`#preset=<encoded-preset>`

The app must validate schema version, size, dataset version, circuit version, numeric ranges, and unknown neuron/edge IDs. Invalid values must be rejected or clamped safely.

### 12.3 File import/export

Support export and import of `.neuralbrush.json`.

### 12.4 Privacy

The user's source photo must not be included in preset URLs, Brain Preset JSON, analytics payloads, or GitHub Pages requests. The default application processes the image in browser memory/GPU resources only.

## 13. Image and Process Export

V1 must support final image export as PNG, JPEG where appropriate, and recording the creative process as a browser-supported video format when available. WebM via `MediaRecorder` is the baseline candidate.

Video export is best-effort by browser capability and must fail gracefully when unsupported. Static image export is required.

## 14. Technology Architecture

### 14.1 Client

- TypeScript
- Vite
- Three.js
- `WebGLRenderer` for V1
- Web Workers for neural simulation
- WebGL shader/render-target pipeline for photo effects
- native browser File APIs
- native Canvas/ImageBitmap APIs where useful

WebGLRenderer is intentionally selected for V1 stability. WebGPU may be evaluated later behind a renderer abstraction.

### 14.2 Major modules

```text
src/
  app/
    NeuralBrushApp.ts
    AppState.ts
  brain/
    BrainEngine.ts
    BrainWorker.ts
    BrainProtocol.ts
    ModulationLayer.ts
    BrainRenderer.ts
    CircuitLoader.ts
  fly/
    FlyController.ts
    FlyPhysics.ts
    FlyRenderer.ts
  vision/
    LocalVision.ts
    SensoryAdapter.ts
    AIVisionAdapter.ts
  brush/
    BrushPipeline.ts
    SmearPass.ts
    SaturationPass.ts
    GlowPass.ts
  preset/
    BrainPreset.ts
    PresetCodec.ts
    PresetValidation.ts
  export/
    ImageExporter.ts
    ProcessRecorder.ts
  ui/
    SplitView.ts
    BrainPanel.ts
    CanvasPanel.ts

tools/
  malecns-export/

public/
  data/
    male-cns-v1/
      circuit.bin
      metadata.json

docs/
  science.md
  data-attribution.md
  architecture.md
```

Each subsystem should expose a narrow interface and remain testable independently.

## 15. Data Flow

```text
User Photo
   |
   v
GPU Texture / Local Image State
   |
   +----> LocalVision ----> SensoryAdapter
   |                           |
   |                           v
   |                     BrainWorker
   |                           |
   |                           v
   |                    behavior state
   |                           |
   |                           v
   |                     FlyController
   |                           |
   |                           v
   +<---- BrushPipeline <---- fly state
```

The UI observes, but does not own, simulation state.

## 16. Rendering and Performance

Reference target:

- responsive desktop interaction,
- approximately 60 FPS rendering on a typical modern desktop browser under normal V1 circuit size,
- no long main-thread neural computation,
- quick initial circuit load.

Initial budgets to validate during implementation:

- compact neural data payload: target <= 10 MB compressed/static assets,
- neural worker average step comfortably below its timestep budget,
- no unbounded object creation per frame,
- no per-neuron `THREE.Mesh` when instancing/batched geometry is appropriate.

Brain nodes should use efficient instancing/buffer techniques where practical. Connections should use batched buffer geometry rather than thousands of independent line objects.

## 17. Error Handling

The app must handle unsupported image type, oversized or undecodable image, GPU/WebGL initialization failure, missing circuit file, incompatible/corrupted preset, unknown neuron IDs, out-of-range modulation, worker crash, and export failure.

Errors should preserve the original user image and provide a reset/retry route. A neural simulation failure must never silently corrupt or overwrite the source image.

## 18. Privacy and Security

Default V1 behavior:

- no user account,
- no cloud photo storage,
- no backend dependency,
- no hidden photo upload,
- no secret key in client code.

If remote AI Vision is introduced later, it must be explicit opt-in, the UI must state that image or derived data may leave the device, and the provider/backend must remain separate from the static GitHub Pages baseline.

Preset parsing is untrusted input and must be schema validated and size bounded before use.

## 19. Open Source and Licensing

- Neural Brush original application code: MIT License.
- MaleCNS-derived data assets: retain upstream MaleCNS CC-BY licensing/attribution requirements and document them separately.
- Third-party dependencies retain their own licenses.

`docs/data-attribution.md` must record dataset name, version, source project, upstream license, transformation/extraction method, and which distributed files are derived from MaleCNS.

The MIT license must not be presented as relicensing MaleCNS-derived data.

## 20. GitHub Repository and Pages

Repository: `andywongpt-my/neural-brush`

Expected project site:

`https://andywongpt-my.github.io/neural-brush/`

For a project Pages URL, Vite `base` is `/neural-brush/`.

Deployment uses GitHub Actions:

```text
push to main
  -> npm ci
  -> lint/typecheck/test
  -> npm run build
  -> upload dist artifact
  -> deploy to GitHub Pages
```

The Pages workflow must use GitHub's Pages deployment actions and appropriate `pages` / `id-token` permissions.

## 21. Proposed V1 Repository Layout

```text
neural-brush/
├─ src/
├─ public/
│  └─ data/
│     └─ male-cns-v1/
├─ tools/
│  └─ malecns-export/
├─ docs/
│  ├─ superpowers/
│  │  ├─ specs/
│  │  │  └─ 2026-09-15-neural-brush-design.md
│  │  └─ plans/
│  ├─ science.md
│  ├─ data-attribution.md
│  └─ architecture.md
├─ tests/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ deploy-pages.yml
├─ LICENSE
├─ README.md
├─ package.json
└─ vite.config.ts
```

## 22. V1 Must Ship

V1 is complete only when it includes:

1. Public GitHub repository.
2. GitHub Pages deployment.
3. Photo upload for common browser image formats.
4. Brain-first split view.
5. Compact MaleCNS-derived circuit loading.
6. Real-time neural simulation in a Web Worker.
7. Visible live neural activity.
8. Autonomous live fly movement.
9. Direct drag/manual fly control.
10. Local visual sampling and feedback loop.
11. Smear.
12. Saturation.
13. Glow.
14. Neuron stimulation.
15. Neuron inhibition.
16. 0–2x connection gain.
17. Reset-to-baseline behavior.
18. Brain Preset URL sharing.
19. `.neuralbrush.json` import/export.
20. PNG image export.
21. Best-effort process video recording.
22. Data/science attribution documentation.
23. Automated tests for critical deterministic/state logic.

## 23. Explicit V1 Non-Goals

V1 will not include simulation of the complete MaleCNS graph, a claim of complete biological/electrophysiological realism, arbitrary user rewiring, user accounts, cloud photo storage, server-side photo storage, leaderboard, multiplayer, social feed, required paid AI API, mandatory backend, WebGPU-only rendering, or full mobile feature parity with the desktop graph editor.

## 24. Testing Strategy

### Unit tests

Required coverage areas:

- circuit decoding,
- deterministic BrainEngine stepping,
- stimulation/inhibition calculations,
- connection gain bounds,
- reset behavior,
- sensory input normalization,
- fly behavior readout,
- preset serialization round-trip,
- preset validation/rejection,
- deterministic seed behavior.

### Integration tests

Required scenarios:

- load circuit -> start worker -> receive valid state,
- upload test image -> derive visual input -> update brain,
- brain output -> fly state -> brush parameters,
- edited image -> changed next visual sample,
- load shared preset -> reproduce same modulation state,
- source biological data remains unchanged after user modulation.

### Browser/E2E tests

1. Open app.
2. Upload fixture image.
3. Start autonomous fly.
4. Confirm canvas changes.
5. Stimulate a neuron.
6. Confirm behavior state changes.
7. Export PNG.
8. Export preset.
9. Reload app with preset.
10. Confirm preset restoration.

### Performance tests

Measure circuit load time, neural worker step duration, render frame duration, memory growth during a sustained session, and export latency.

## 25. Scientific Transparency

The app must include an accessible Science/About explanation stating that connectivity is derived from MaleCNS, only a selected subgraph is used, topology/source weights come from connectome data, dynamic parameters are simplified modeling assumptions, artistic brush effects are not biological outputs, and AI semantic vision is synthetic external modulation when enabled.

The product may say “MaleCNS-derived” or “connectome-constrained.” It should not say that Neural Brush is a complete simulation of a real fly brain.

## 26. Success Criteria

V1 succeeds when a new visitor can:

1. open the GitHub Pages site without installing anything,
2. upload a photo,
3. immediately see the fly editing it live,
4. simultaneously see a functioning neural graph,
5. alter a neural state and visibly change fly behavior,
6. understand which parts are real connectome data and which are creative simulation,
7. export the final work,
8. share a Brain Preset without sharing the source photo.

The experience should feel like:

**“I am watching and modulating a connectome-derived fly brain while the fly uses its behavior as a living brush.”**

## 27. Implementation Gate

This specification is approved. Implementation proceeds only through reviewed implementation plans derived from this document.