# Neural Brush

Neural Brush is an open-source browser-based creative photo editor where a live fruit fly edits a user-supplied image while a MaleCNS-derived neural circuit is visualized and manipulated alongside it.

> **Current status:** V1 feature implementation is substantially complete on the active development branch: the real MaleCNS-derived compact circuit, closed edited-image feedback loop, autonomous/direct fly control, Smear/Saturation/Glow/Blend, Brain modulation, Brain Preset sharing/import/export, PNG/JPEG export, optional WebM process recording, worker recovery, mobile hardening, and in-app Science/About disclosure are implemented and covered by automated tests. Final V1 release acceptance still requires the production GitHub Pages smoke flow and the real desktop-GPU 60-second performance measurement described in the implementation plan; this README does not mark the release production-ready yet.

The compact V1 circuit contains **151 neurons and 3,901 directed internal edges** and is about **78 KiB** uncompressed across the three runtime data files.

## V1 capabilities

- Brain-first split workspace on desktop; stacked Brain/Canvas layout on narrow screens
- local PNG/JPEG/WebP photo loading
- selected MaleCNS `male-cns:v1.0` circuit with immutable source topology/weights and separate user modulation
- simplified connectome-constrained neural dynamics in a Web Worker
- local edited-image sensory feedback loop
- autonomous fly movement plus pointer/touch drag override
- Smear, Saturation, Glow, and Blend brush modes
- neuron stimulation/inhibition and `0..2×` connection-gain modulation
- URL-fragment Brain Preset sharing
- `.neuralbrush.json` Brain Preset import/export
- PNG/JPEG final-artwork export from the edited offscreen texture
- best-effort WebM process recording from the visible photo canvas
- fatal Brain Worker recovery without clearing current artwork
- decoded-image resource limits and mobile/touch hardening
- in-app About / Science disclosure
- no required backend for the static V1

## Architecture

Primary implementation stack:

- TypeScript + Vite
- Three.js with `WebGLRenderer`
- Web Worker neural runtime
- WebGL render targets/shaders for live image effects
- static MaleCNS-derived runtime data under `public/data/male-cns-v1/`
- GitHub Actions CI and GitHub Pages deployment workflow

The live closed loop is:

```text
CircuitGraph
→ ModulationLayer
→ Brain Worker
→ BehaviorState
→ Fly
→ BrushPipeline
→ EditedImageSampler
→ SensoryAdapter
→ Brain Worker
```

See [`docs/architecture.md`](docs/architecture.md) for runtime timing, resource limits, export boundaries, worker recovery, and privacy/data-flow details.

The approved product design is in [`docs/superpowers/specs/2026-09-15-neural-brush-design.md`](docs/superpowers/specs/2026-09-15-neural-brush-design.md).

## Local development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

Run the validation gates:

```bash
python -m unittest discover -s tests/python -p 'test_*.py'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
```

The offline MaleCNS data pipeline has separate reproduction instructions in [`tools/malecns-export/README.md`](tools/malecns-export/README.md). The canonical V1 exporter uses the **official public bulk MaleCNS v1.0 Feather files and does not require a neuPrint token**. A token-based `malecns`/R exporter remains available as an optional cross-check path; credentials must never be committed.

## GitHub Pages

The repository is configured for the project Pages URL:

`https://andywongpt-my.github.io/neural-brush/`

Vite uses the project-site base path `/neural-brush/`. Pushes to `main` trigger the Pages build/deploy workflow.

The final release checklist requires verifying the deployed app in a fresh browser with:

`upload → live edit → Brain modulation → PNG export → Brain Preset share/restore`

The repository should only be described as production-ready after that production smoke flow and the remaining performance acceptance have passed.

## Privacy contract

**Static V1 processes source photos locally in the browser.**

The core image path is:

```text
user File
→ ImageBitmap
→ Three.js/WebGL texture and render targets
→ local browser exports
```

For the core V1:

- there is no required application backend,
- there is no required cloud photo store,
- the source photo is not uploaded by the static application,
- Brain Presets and `#preset=...` share fragments do not include the source photo,
- Brain Presets/share fragments do not include the source filename,
- Brain Presets contain only validated modulation deltas, brush mode, seed, and dataset/circuit/version identifiers.

Future optional AI Vision integrations must remain explicit opt-in, define their own network/privacy boundary, and must not place secret service API keys in the public GitHub Pages client.

## Brain Presets

Brain Presets are deliberately small and source-image-independent.

A preset can capture:

- neuron stimulation/inhibition deltas,
- connection-gain deltas,
- brush mode,
- deterministic seed,
- dataset/circuit/preset version identifiers.

Small presets can be shared in the URL fragment; file import/export uses `.neuralbrush.json`. Invalid or graph-incompatible presets are rejected without replacing the source graph.

This supports the product idea: **“Try my brain on your photo.”** The recipient supplies their own local image.

## Export behavior

### Final artwork

PNG/JPEG export reads the edited offscreen WebGL target at the decoded image's original dimensions. The exported image excludes the visible fly overlay and excludes the Brain panel.

### Process recording

WebM process recording captures the visible photo canvas at 30 fps when browser capabilities permit it. It includes the live fly overlay but excludes the Brain panel. Browsers without the required MediaRecorder/canvas-capture support still retain PNG/JPEG export.

## Resource and recovery safeguards

Photo validation includes:

- accepted MIME types: PNG/JPEG/WebP,
- 25 MiB source-file limit,
- maximum decoded dimension: 8192 px on either axis,
- maximum decoded pixel count: 40,000,000 pixels.

A fatal Brain Worker error stops neural-driven autonomous editing and exposes `Restart Brain`. Restart creates a fresh worker using the loaded graph, current seed, and current modulation state; it does not clear the uploaded photo or edited artwork.

## MaleCNS data and scientific scope

Neural Brush uses a selected connectome subgraph derived from the Janelia FlyEM Male CNS dataset `male-cns:v1.0`.

Source topology, neuron identifiers, source connection weights, and available annotations in that selected graph are connectome-derived. Neural Brush-specific modulation, neural equations, sensory adapter, behavior interface, fly control, and brush mapping are separate application layers.

The V1 source-data layer uses source-verified DNa01/DNa02 laterality for `turnLeft` and `turnRight`. It deliberately leaves the source-data `forward` behavior port empty rather than inventing a forward-speed command that is not established by this circuit selection.

Neural Brush is **not** a complete biological or electrophysiological simulation of a fruit-fly brain. Neural activity equations are simplified modeling assumptions; photo feature injection is a synthetic sensory adapter; and Smear, Saturation, and Glow are artistic mappings rather than biological motor outputs.

Any future optional AI semantic vision is external synthetic modulation and must be labeled accordingly.

- Scientific/modeling boundary: [`docs/science.md`](docs/science.md)
- Dataset provenance, hashes, derived-file boundary, and licensing: [`docs/data-attribution.md`](docs/data-attribution.md)
- Implemented software/data flow: [`docs/architecture.md`](docs/architecture.md)

## Licensing

Neural Brush original application code is licensed under the **MIT License**.

MaleCNS source data and the MaleCNS-derived browser assets under `public/data/male-cns-v1/` are separate from the MIT code-license grant. The official MaleCNS project licenses the dataset under **Creative Commons Attribution 4.0 International (CC BY 4.0)**:

https://creativecommons.org/licenses/by/4.0/

See [`docs/data-attribution.md`](docs/data-attribution.md) for the source URLs, extraction/adaptation description, verified hashes, and attribution boundary.
