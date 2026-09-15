# Neural Brush Foundation & GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a tested, deployable Neural Brush web shell with Brain-first split view, local image upload, a Three.js canvas, CI, and GitHub Pages deployment.

**Architecture:** Use a framework-free Vite + TypeScript application. `NeuralBrushApp` owns composition and delegates DOM/UI responsibilities to small view classes; `CanvasPanel` owns the Three.js renderer and source image texture, while `BrainPanel` is initially a deterministic placeholder surface that later plans replace with the real graph renderer.

**Tech Stack:** TypeScript, Vite, Three.js `WebGLRenderer`, Vitest, Playwright, ESLint, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-15-neural-brush-design.md`

## Global Constraints

- Desktop V1 uses a persistent Brain-first split view with an initial **58% Brain / 42% Canvas** ratio.
- Vite `base` must be exactly `/neural-brush/` for the project Pages URL.
- Use Three.js `WebGLRenderer` in V1; do not make WebGPU a requirement.
- User photos remain local to browser memory/GPU resources; this plan adds no backend and no upload endpoint.
- No secret service API key may exist in the GitHub Pages build.
- Source image errors must not destroy the previously loaded valid image.
- Keep each module focused; do not create a monolithic app file.

---

### Task 1: Scaffold the TypeScript/Vite testable application

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `tests/unit/smoke.test.ts`
- Create: `tests/e2e/app.spec.ts`

**Interfaces:**
- Produces: Vite app entry at `src/main.ts`.
- Produces: npm scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`.
- Later tasks consume the `#app` host element from `index.html`.

- [ ] **Step 1: Write the failing unit smoke test**

```ts
// tests/unit/smoke.test.ts
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '../../src/app/constants';

describe('application constants', () => {
  it('uses the approved product name', () => {
    expect(APP_NAME).toBe('Neural Brush');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails because the module does not exist**

Run: `npm test -- --run tests/unit/smoke.test.ts`

Expected: FAIL with a module-resolution error for `src/app/constants`.

- [ ] **Step 3: Add the minimal project scaffold and constant**

Use these package scripts and dependencies:

```json
{
  "name": "neural-brush",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "three": "^0.180.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@playwright/test": "^1.55.0",
    "@types/three": "^0.180.0",
    "eslint": "^9.0.0",
    "typescript": "^5.9.0",
    "typescript-eslint": "^8.0.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

Create:

```ts
// src/app/constants.ts
export const APP_NAME = 'Neural Brush' as const;
```

Set Vite base explicitly:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/neural-brush/',
});
```

Create `index.html` with a single `<div id="app"></div>` and module script `/src/main.ts`. Import `./styles.css` from `src/main.ts`.

- [ ] **Step 4: Run the unit test, typecheck, and production build**

Run:

```bash
npm install
npm test -- --run tests/unit/smoke.test.ts
npm run typecheck
npm run build
```

Expected: all commands PASS and `dist/index.html` exists.

- [ ] **Step 5: Add a minimal Playwright boot smoke test**

```ts
// tests/e2e/app.spec.ts
import { expect, test } from '@playwright/test';

test('boots the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
});
```

Configure Playwright `webServer.command` as `npm run dev -- --host 127.0.0.1`, `url` as `http://127.0.0.1:5173`, and `use.baseURL` to the same URL.

Run: `npx playwright install chromium && npm run test:e2e`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js index.html src tests

git commit -m "chore: scaffold Neural Brush web app"
```

---

### Task 2: Implement the Brain-first split view and application state

**Files:**
- Create: `src/app/AppState.ts`
- Create: `src/app/NeuralBrushApp.ts`
- Create: `src/ui/SplitView.ts`
- Create: `src/ui/BrainPanel.ts`
- Create: `src/ui/CanvasPanel.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Create: `tests/unit/AppState.test.ts`
- Modify: `tests/e2e/app.spec.ts`

**Interfaces:**
- Produces: `type PanelRatio = number` clamped to `0.35..0.75`.
- Produces: `AppState.setSplitRatio(ratio: number): void` and `AppState.getSnapshot(): AppSnapshot`.
- Produces: `SplitView.mount(host: HTMLElement): { brainHost: HTMLElement; canvasHost: HTMLElement }`.
- `NeuralBrushApp` owns `AppState`, `SplitView`, `BrainPanel`, and `CanvasPanel`.

- [ ] **Step 1: Write failing AppState clamping tests**

```ts
// tests/unit/AppState.test.ts
import { describe, expect, it } from 'vitest';
import { AppState } from '../../src/app/AppState';

describe('AppState split ratio', () => {
  it('starts at the approved 58/42 ratio', () => {
    expect(new AppState().getSnapshot().splitRatio).toBe(0.58);
  });

  it('clamps the draggable divider to safe bounds', () => {
    const state = new AppState();
    state.setSplitRatio(0.1);
    expect(state.getSnapshot().splitRatio).toBe(0.35);
    state.setSplitRatio(0.95);
    expect(state.getSnapshot().splitRatio).toBe(0.75);
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- --run tests/unit/AppState.test.ts`

Expected: FAIL because `AppState` does not exist.

- [ ] **Step 3: Implement state and split view**

```ts
// src/app/AppState.ts
export interface AppSnapshot {
  splitRatio: number;
  imageName: string | null;
}

export class AppState {
  private splitRatio = 0.58;
  private imageName: string | null = null;

  setSplitRatio(value: number): void {
    this.splitRatio = Math.min(0.75, Math.max(0.35, value));
  }

  setImageName(name: string | null): void {
    this.imageName = name;
  }

  getSnapshot(): AppSnapshot {
    return { splitRatio: this.splitRatio, imageName: this.imageName };
  }
}
```

`SplitView` must create semantic `<section aria-label="Brain">` and `<section aria-label="Canvas">` regions separated by a pointer-draggable divider. Pointer moves calculate the ratio from the split container's bounding box and call an injected `onRatioChange(number)` callback. Keyboard `ArrowLeft` / `ArrowRight` on the divider adjusts by `0.02`.

`BrainPanel` initially renders product name, `MaleCNS circuit: not loaded`, and a disabled `Run` button. `CanvasPanel` initially renders an upload drop zone host plus a Three.js canvas host.

- [ ] **Step 4: Wire `NeuralBrushApp` and verify unit/E2E behavior**

`src/main.ts` must resolve `#app`, throw a clear error when absent, create `new NeuralBrushApp(host)`, and call `mount()`.

Extend Playwright:

```ts
await expect(page.getByRole('region', { name: 'Brain' })).toBeVisible();
await expect(page.getByRole('region', { name: 'Canvas' })).toBeVisible();
await expect(page.getByText('MaleCNS circuit: not loaded')).toBeVisible();
```

Run:

```bash
npm test -- --run tests/unit/AppState.test.ts
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Add responsive CSS without hiding either primary region**

Desktop: CSS grid columns are driven by `--brain-ratio` / `--canvas-ratio`. Under `800px`, switch to two rows, Brain first, Canvas second, and disable drag-resizing while preserving both sections.

Run: `npm run build && npm run test:e2e`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests

git commit -m "feat: add Brain-first split workspace"
```

---

### Task 3: Add safe local image loading and a Three.js photo scene

**Files:**
- Create: `src/image/ImageLoader.ts`
- Create: `src/render/CanvasRenderer.ts`
- Modify: `src/ui/CanvasPanel.ts`
- Modify: `src/app/NeuralBrushApp.ts`
- Modify: `src/app/AppState.ts`
- Create: `tests/unit/ImageLoader.test.ts`
- Modify: `tests/e2e/app.spec.ts`

**Interfaces:**
- Produces: `ImageLoader.decode(file: File): Promise<ImageBitmap>`.
- `ImageLoader` accepts MIME types `image/jpeg`, `image/png`, `image/webp` and rejects files over `25 * 1024 * 1024` bytes.
- Produces: `CanvasRenderer.setImage(bitmap: ImageBitmap): void`.
- Produces: `CanvasRenderer.resize(width: number, height: number, dpr: number): void`.
- Produces: `CanvasRenderer.dispose(): void`.

- [ ] **Step 1: Write failing image validation tests**

```ts
// tests/unit/ImageLoader.test.ts
import { describe, expect, it } from 'vitest';
import { ImageLoader } from '../../src/image/ImageLoader';

describe('ImageLoader validation', () => {
  it('rejects unsupported image types before decoding', async () => {
    const file = new File(['x'], 'x.gif', { type: 'image/gif' });
    await expect(ImageLoader.decode(file)).rejects.toThrow('Unsupported image type');
  });

  it('rejects files larger than 25 MiB', async () => {
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    await expect(ImageLoader.decode(file)).rejects.toThrow('Image exceeds 25 MiB');
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- --run tests/unit/ImageLoader.test.ts`

Expected: FAIL because `ImageLoader` does not exist.

- [ ] **Step 3: Implement validation and decoding**

```ts
// src/image/ImageLoader.ts
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 25 * 1024 * 1024;

export class ImageLoader {
  static async decode(file: File): Promise<ImageBitmap> {
    if (!ACCEPTED.has(file.type)) throw new Error('Unsupported image type');
    if (file.size > MAX_BYTES) throw new Error('Image exceeds 25 MiB');
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new Error('Could not decode image');
    }
  }
}
```

Implement `CanvasRenderer` with a `THREE.Scene`, orthographic camera, plane mesh, `THREE.Texture` created from the bitmap, and `WebGLRenderer({ antialias: true, preserveDrawingBuffer: false })`. Fit the photo inside the canvas while preserving aspect ratio.

- [ ] **Step 4: Wire upload UI while preserving the previous valid image on failure**

`CanvasPanel` must include a labeled `<input type="file" accept="image/png,image/jpeg,image/webp">` and drop zone. Decode into a temporary bitmap first; only after successful decode call `renderer.setImage(bitmap)` and `state.setImageName(file.name)`. On failure, show a non-destructive inline error and leave the previous texture untouched.

Run: `npm test -- --run tests/unit/ImageLoader.test.ts && npm run typecheck`.

Expected: PASS.

- [ ] **Step 5: Add an E2E image fixture flow**

Create `tests/fixtures/test-image.png` as a tiny checked-in PNG fixture. Extend Playwright to call `setInputFiles`, then assert the filename appears and the canvas is visible.

Run: `npm run test:e2e`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests

git commit -m "feat: add local photo loading and Three canvas"
```

---

### Task 4: Add graceful WebGL and app-level error states

**Files:**
- Create: `src/app/AppError.ts`
- Create: `src/ui/ErrorBanner.ts`
- Modify: `src/render/CanvasRenderer.ts`
- Modify: `src/app/NeuralBrushApp.ts`
- Create: `tests/unit/AppError.test.ts`

**Interfaces:**
- Produces: `AppErrorCode = 'WEBGL_UNAVAILABLE' | 'IMAGE_DECODE' | 'APP_INIT'`.
- Produces: `AppError` with `code`, user-safe `message`, and optional `cause`.
- `ErrorBanner.show(error: AppError): void` must not throw.

- [ ] **Step 1: Write the failing error mapping test**

```ts
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/app/AppError';

describe('AppError', () => {
  it('uses a user-safe WebGL message', () => {
    expect(new AppError('WEBGL_UNAVAILABLE').message).toContain('WebGL');
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run tests/unit/AppError.test.ts`

Expected: FAIL because `AppError` does not exist.

- [ ] **Step 3: Implement typed errors and WebGL detection**

`CanvasRenderer` must catch renderer construction failures and throw `new AppError('WEBGL_UNAVAILABLE', cause)`. The public message must explain that Neural Brush needs WebGL2/WebGL support and suggest trying a current browser or enabling hardware acceleration.

- [ ] **Step 4: Render recoverable errors in the UI**

Image errors render inside Canvas; app-init/WebGL errors render at workspace level. Never replace the original source file object or previous valid bitmap because an error occurred.

Run: `npm test -- --run && npm run build`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests

git commit -m "feat: add recoverable app error states"
```

---

### Task 5: Add CI and GitHub Pages deployment

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`

**Interfaces:**
- CI gates `main` and pull requests on install, lint, typecheck, unit tests, build.
- Pages deployment publishes `dist/` from `main`.

- [ ] **Step 1: Add the CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run build
```

- [ ] **Step 2: Add the GitHub Pages workflow**

```yaml
# .github/workflows/deploy-pages.yml
name: Deploy Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Update README with local commands and privacy baseline**

Document `npm install`, `npm run dev`, `npm test -- --run`, `npm run build`, the expected Pages URL `https://andywongpt-my.github.io/neural-brush/`, and the statement: “Photos are processed locally in the browser in V1 and are not uploaded by the static app.”

- [ ] **Step 4: Run the complete local gate**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit and verify Actions after push**

```bash
git add .github README.md

git commit -m "ci: add validation and GitHub Pages deployment"
git push origin main
```

Expected on GitHub: CI succeeds; Pages workflow builds and deploys the static shell. If Pages is not yet configured to use GitHub Actions, set **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**, then rerun the workflow.

---

## Plan 1 Completion Gate

Before starting Plan 2, verify all of the following:

- `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build` pass.
- The site opens from the GitHub Pages project URL.
- Brain and Canvas are both visible; desktop starts at 58/42.
- Divider resizing works with pointer and keyboard.
- PNG/JPEG/WebP local upload renders in Three.js.
- Invalid files do not destroy the previous valid image.
- No backend request is made with the user's image.
