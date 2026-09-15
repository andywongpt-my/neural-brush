# Neural Brush

Neural Brush is an open-source browser-based creative photo editor where a live fruit fly edits a user-supplied image while a MaleCNS-derived neural circuit is visualized alongside it.

> Current implementation status: V1 foundation. The Brain-first workspace, local photo loading, Three.js canvas, typed error handling, CI, and GitHub Pages deployment are being established before the MaleCNS data pipeline and neural runtime are added.

## V1 architecture

- TypeScript + Vite
- Three.js with `WebGLRenderer`
- Brain-first 58/42 split workspace on desktop
- local PNG/JPEG/WebP photo loading
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

## GitHub Pages

The project is configured for the repository Pages URL:

`https://andywongpt-my.github.io/neural-brush/`

Vite uses the project-site base path `/neural-brush/`. Pushes to `main` trigger the Pages build/deploy workflow.

If GitHub Pages has not yet been enabled for the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** and rerun the `Deploy Pages` workflow.

## Privacy baseline

**Photos are processed locally in the browser in V1 and are not uploaded by the static app.**

The current image path is browser-local: user `File` → `ImageBitmap` → Three.js GPU texture. Neural Brush does not require a server to receive the source photo.

Future optional AI Vision integrations must remain explicit opt-in and must not place secret service API keys in the GitHub Pages client.

## Scientific scope

Neural Brush is intended to use a selected MaleCNS-derived connectome subgraph. It is not a complete electrophysiological simulation of a fruit-fly brain. Source biological facts and creative/simplified simulation layers are kept conceptually separate in the approved design.

## License

Neural Brush application code is licensed under the MIT License. MaleCNS-derived data will retain its upstream attribution and licensing requirements separately when those assets are introduced.
