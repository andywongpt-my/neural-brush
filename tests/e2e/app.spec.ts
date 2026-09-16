import { expect, test } from '@playwright/test';

interface NeuralBrushTestApi {
  editedChecksum(): number | null;
  fly(): { x: number; y: number };
  photoClientPoint(x: number, y: number): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __NEURAL_BRUSH_TEST__?: NeuralBrushTestApi;
  }
}

test('boots the Brain-first workspace with a live MaleCNS worker', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Brain', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled();
  await expect(page.getByTestId('brain-turn')).toBeVisible();
  await expect(page.getByTestId('brain-forward')).toBeVisible();
  await expect(page.getByTestId('brain-dwell')).toBeVisible();
  await expect(page.getByTestId('brain-arousal')).toBeVisible();

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('MaleCNS circuit: paused')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeEnabled();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible();
});

test('renders the live MaleCNS graph with source facts separate from modulation controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });

  await expect(page.locator('canvas.brain-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source facts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Neuron' })).toBeVisible();
  await expect(page.getByText('Dataset')).toBeVisible();
  await expect(page.getByText('Body ID')).toBeVisible();
  await expect(page.getByText('Neurotransmitter prediction')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Stimulation' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Inhibition' })).toBeVisible();
});

test('loads a local image into the Three.js canvas while the brain remains ready', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/test-image.png');

  await expect(page.getByText('test-image.png')).toBeVisible();
  await expect(page.locator('canvas.photo-canvas')).toBeVisible();
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible();
});

test('keeps the previous valid image when a later file is rejected', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByLabel('Choose photo');

  await picker.setInputFiles('tests/fixtures/test-image.png');
  await expect(page.getByText('test-image.png')).toBeVisible();

  await picker.setInputFiles('tests/fixtures/unsupported.gif');

  await expect(page.getByText('test-image.png')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('valid PNG, JPEG, or WebP');
  await expect(page.locator('canvas.photo-canvas')).toBeVisible();
});

test('closes the live edit-brain-fly loop and exposes local performance diagnostics', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  await expect(page.getByTestId('debug-frame-average')).toBeVisible();
  await expect(page.getByTestId('debug-frame-p95')).toBeVisible();
  await expect(page.getByTestId('debug-fly-position')).toBeVisible();

  const readChecksum = () =>
    page.evaluate(() => window.__NEURAL_BRUSH_TEST__?.editedChecksum() ?? null);

  await expect.poll(readChecksum).not.toBeNull();
  const initialChecksum = await readChecksum();
  await expect.poll(readChecksum, { timeout: 4_000 }).not.toBe(initialChecksum);

  await expect
    .poll(async () => Number(await page.getByTestId('debug-frame-average').textContent()))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await page.getByTestId('debug-frame-p95').textContent()))
    .toBeGreaterThan(0);

  const neuronSelect = page.getByRole('combobox', { name: 'Neuron' });
  await neuronSelect.evaluate((element) => {
    const select = element as HTMLSelectElement;
    const match = Array.from(select.options).find((option) =>
      option.textContent?.includes('DNa01'),
    );
    if (!match) throw new Error('DNa01 neuron option is missing');
    select.value = match.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('MaleCNS circuit: paused')).toBeVisible();
  const turnBefore = await page.getByTestId('brain-turn').textContent();
  await page.getByRole('slider', { name: 'Stimulation' }).evaluate((element) => {
    const slider = element as HTMLInputElement;
    slider.value = '1';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible();
  await expect
    .poll(async () => page.getByTestId('brain-turn').textContent(), { timeout: 5_000 })
    .not.toBe(turnBefore);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('MaleCNS circuit: paused')).toBeVisible();
  const beforePositionText = await page.getByTestId('debug-fly-position').textContent();
  const beforeFly = await page.evaluate(() => window.__NEURAL_BRUSH_TEST__?.fly() ?? null);
  expect(beforeFly).not.toBeNull();
  const targetX = beforeFly!.x < 0.7 ? beforeFly!.x + 0.2 : beforeFly!.x - 0.2;

  const dragPoints = await page.evaluate(
    ({ startX, startY, endX }) => ({
      start: window.__NEURAL_BRUSH_TEST__?.photoClientPoint(startX, startY) ?? null,
      end: window.__NEURAL_BRUSH_TEST__?.photoClientPoint(endX, startY) ?? null,
    }),
    { startX: beforeFly!.x, startY: beforeFly!.y, endX: targetX },
  );
  expect(dragPoints.start).not.toBeNull();
  expect(dragPoints.end).not.toBeNull();

  await page.mouse.move(dragPoints.start!.x, dragPoints.start!.y);
  await page.mouse.down();
  await page.mouse.move(dragPoints.end!.x, dragPoints.end!.y, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () => page.getByTestId('debug-fly-position').textContent())
    .not.toBe(beforePositionText);
  const afterFly = await page.evaluate(() => window.__NEURAL_BRUSH_TEST__?.fly() ?? null);
  expect(afterFly).not.toBeNull();
  expect(Math.abs(afterFly!.x - beforeFly!.x)).toBeGreaterThan(0.05);
});
