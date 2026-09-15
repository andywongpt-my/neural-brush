# Neural Brush

Neural Brush is an open-source browser-based creative photo editor where a live fruit fly edits a user-supplied image while a MaleCNS-derived neural circuit is visualized alongside it.

> Current implementation status: the V1 foundation is implemented, including the Brain-first workspace, local photo loading, Three.js canvas, typed error handling, CI, and the GitHub Pages deployment workflow. The reproducible MaleCNS `male-cns:v1.0` schema, exporter, deterministic binary packer, and strict browser circuit loader are also implemented. Real production circuit assets are intentionally not committed yet: they must be generated from the real dataset with a user-supplied neuPrint token and pass the Plan 2 data checks before they are treated as V1 source data.

## V1 architecture

- TypeScript + Vite
- Three.js with `WebGLRenderer`
- Brain-first 58/42 split workspace on desktop
- local PNG/JPEG/WebP photo loading
- deterministic MaleCNS-derived compact circuit format and browser loader
- no required backend for the static V1
- GitHub Pages deployment from `main`

The approved product design is in [`docs/superpowers/specs/2026-09-15-neural-brush-design.md`](docs/superpowers/specs/2026-09-15-neural-brush-design.md).

## Local development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

Run the validation gates:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
```

The offline MaleCNS data pipeline has separate reproduction instructions in [`tools/malecns-export/README.md`](tools/malecns-export/README.md). It requires a private `neuprint_token`; credentials must never be committed.

## GitHub Pages

The project is configured for the repository Pages URL:

`https://andywongpt-my.github.io/neural-brush/`

Vite uses the project-site base path `/neural-brush/`. Pushes to `main` trigger the Pages build/deploy workflow.

If GitHub Pages has not yet been enabled for the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** and rerun the `Deploy Pages` workflow.

## Privacy baseline

**Photos are processed locally in the browser in V1 and are not uploaded by the static app.**

The current image path is browser-local: user `File` → `ImageBitmap` → Three.js GPU texture. Neural Brush does not require a server to receive the source photo.

Future optional AI Vision integrations must remain explicit opt-in and must not place secret service API keys in the GitHub Pages client.

## MaleCNS data and scientific scope

Neural Brush targets a selected connectome subgraph derived from the Janelia FlyEM Male CNS dataset `male-cns:v1.0`. Source topology, source connection weights, neuron identity, and available source metadata are kept separate from Neural Brush-specific adapter, behavior-readout, dynamics, and artistic layers.

Neural Brush is **not** a complete biological or electrophysiological simulation of a fruit-fly brain. Frontier `inputPort` nodes are application graph boundaries rather than claims about retinal identity; photo-derived sensory signals are synthetic external inputs; and Smear, Saturation, and Glow are artistic outputs rather than biological motor outputs.

- Dataset provenance, derived-file boundaries, and licensing: [`docs/data-attribution.md`](docs/data-attribution.md)
- Scientific/modeling boundary: [`docs/science.md`](docs/science.md)

## License

Neural Brush original application code is licensed under the MIT License. MaleCNS source data and MaleCNS-derived assets retain their upstream attribution/licensing requirements; the repository's MIT license does not relicense those data assets.
