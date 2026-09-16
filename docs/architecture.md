# Neural Brush V1 Architecture

Neural Brush V1 is a static, browser-local application. The production target is GitHub Pages; no application backend is required for photo editing, MaleCNS simulation, Brain Presets, image export, or process recording.

This document describes the implemented runtime architecture and the boundaries between immutable source data, mutable simulation state, creative rendering, exports, and privacy-sensitive user data.

## High-level data flow

The live closed loop is:

```text
MaleCNS-derived CircuitGraph (immutable source facts)
        ↓
ModulationLayer (user stimulation / inhibition / edge gain)
        ↓
Brain Worker (simplified connectome-constrained dynamics)
        ↓
BehaviorState (turn / forward / dwell / arousal)
        ↓
FlyController
        ↓
BrushPipeline (Smear / Saturation / Glow / Blend)
        ↓
EditedImageSampler
        ↓
SensoryAdapter
        └──────────────────────────────→ Brain Worker
```

The current edited texture therefore becomes the next sensory input. The loop is continuous while the brain is ready and a photo is loaded.

## 1. Immutable connectome layer

`CircuitLoader` loads the compact static bundle from `public/data/male-cns-v1/` and constructs a `CircuitGraph`.

The V1 bundle is derived from MaleCNS `male-cns:v1.0` and preserves source-derived information such as:

- body IDs,
- directed topology,
- source connection weights,
- type/instance annotations when available,
- source soma-side metadata when available,
- predicted/consensus neurotransmitter metadata when available.

The source weights and topology are not mutated at runtime. UI controls operate through a separate modulation layer.

The offline generation pipeline lives under `tools/malecns-export/`; it is not executed by the GitHub Pages client.

## 2. Modulation layer

`ModulationLayer` owns the reversible user-adjustable state:

- per-neuron stimulation `0..1`,
- per-neuron inhibition `0..1`,
- per-edge connection gain `0..2`.

Neutral state means zero stimulation/inhibition and `1×` connection gain. Resetting the Brain returns this layer to neutral without rewriting the `CircuitGraph`.

Brain Presets serialize only modulation deltas, brush mode, seed, and dataset/circuit/version identifiers. They do not serialize the source image, filename, image pixels, current activation arrays, or image-derived semantic data.

## 3. Brain worker and timing

Neural dynamics run in a Web Worker through `BrainWorkerClient`.

The model uses the real selected graph topology and source weights as constraints, but its activation equations, transforms, decay/interpolation behavior, and seeded noise are Neural Brush modeling assumptions rather than reconstructed electrophysiology.

Timing boundaries in V1:

- neural logical step: fixed **60 Hz**,
- worker state publication: approximately **30 Hz**,
- edited-image sensory sampling: **30 Hz**,
- fly physics / GPU brush / visible Canvas rendering: `requestAnimationFrame`, normally display-rate driven,
- Brain graph activation visualization: throttled separately to approximately **12 Hz**.

Logical neural time is fixed-step and does not change merely because wall-clock rendering is slower.

## 4. Synthetic sensory adapter

The photo does not enter the connectome as a claimed biological retina reconstruction.

`EditedImageSampler` reads a local patch around the current fly position from the edited GPU target. Local image features are converted by `SensoryAdapter` into external simulation drive for selected circuit frontier nodes.

That mapping is a **synthetic sensory adapter**. Frontier `inputPort` nodes are application graph boundaries, not claims that those cells are verified photoreceptors or retinal input neurons.

Any future optional AI semantic vision would be an additional external synthetic modulation layer and must remain explicitly labeled as such.

## 5. Behavior and fly layer

The worker publishes a small `BehaviorState`:

- `turn`,
- `forward`,
- `dwell`,
- `arousal`.

These are application-facing readouts, not native MaleCNS artistic channels.

`FlyController` converts those readouts into fly motion. Direct pointer/touch dragging temporarily overrides autonomous movement; releasing the fly returns control to the neural/autonomous loop.

## 6. GPU brush pipeline

`BrushPipeline` applies the creative effects to offscreen WebGL render targets:

- Smear,
- Saturation,
- Glow,
- Blend.

These are **artistic mappings**, not biological motor outputs.

The pipeline maintains the edited texture independently from the visible fly sprite. This separation is important for final-image export.

## 7. Export boundaries

### PNG / JPEG

Final artwork export reads `BrushPipeline.currentTarget` directly through WebGL render-target readback, flips WebGL's bottom-up row orientation, and encodes an image at the original decoded image dimensions.

Because the export source is the offscreen edited target:

- the fly overlay is excluded,
- the Brain panel is excluded,
- only the edited artwork is exported.

### WebM process recording

Process recording uses `photo-canvas.captureStream(30)` with `MediaRecorder`.

Because the recorder captures the visible Canvas:

- the live fly overlay is included,
- the Brain panel is excluded.

WebM is best-effort and capability-gated. Lack of MediaRecorder/captureStream support does not disable PNG/JPEG export.

## 8. Brain Preset sharing

Small presets can be encoded into a `#preset=...` URL fragment. File export/import uses `.neuralbrush.json`.

Safety and size limits:

- decoded URL-preset JSON: maximum 16 KiB,
- preset file import: maximum 64 KiB,
- graph-aware validation rejects unknown body/edge IDs and invalid ranges.

Startup restoration order is:

```text
load circuit
→ initialize neutral modulation
→ decode URL fragment
→ validate against loaded graph
→ apply preset
→ initialize worker with preset seed
→ render live UI
```

An invalid shared preset produces a dismissible warning and falls back to a neutral usable Brain.

## 9. Photo/resource limits

V1 validates images before GPU upload:

- accepted formats: PNG, JPEG, WebP,
- source file-size ceiling: 25 MiB,
- maximum decoded width or height: 8192 px,
- maximum decoded pixel count: 40,000,000 pixels.

If a new image is rejected after decode, its temporary bitmap is closed and the previous valid artwork remains intact.

## 10. Worker recovery

A fatal Worker `error` or `messageerror` transitions the Brain to an error state and stops autonomous neural-driven editing.

`Restart Brain` constructs a fresh worker using:

- the already loaded `EngineGraph`,
- the same current seed,
- the current modulation snapshot.

It clears stale neural activation/sensory runtime state but does **not** reset the uploaded photo, edited GPU artwork, or Brain modulation controls.

## 11. Privacy boundary

For the static V1, source photos are processed locally in the browser:

```text
user File
→ ImageBitmap
→ WebGL texture / render targets
→ local exports
```

The application has no required backend and no required cloud photo store. Brain Presets and share fragments do not contain the photo or filename.

A future networked or AI-vision feature must remain explicit opt-in and must define a separate privacy boundary; secret service API keys must never be embedded in the public GitHub Pages client.

## 12. Responsive UI

Desktop uses a Brain-first split workspace. Under 800 px, Brain stacks above Canvas, the Canvas retains a usable minimum height, core controls use touch-sized targets, and neuron-inspector sections become collapsed disclosures by default.

## Scientific boundary

Architecture describes what the software does; it does not expand the scientific claim. See [`science.md`](science.md) for the exact distinction between connectome-derived facts and Neural Brush modeling/creative assumptions, and [`data-attribution.md`](data-attribution.md) for MaleCNS provenance and licensing.
