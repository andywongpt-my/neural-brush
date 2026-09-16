import { expect, test } from '@playwright/test';

test('boots the Brain-first workspace with a live MaleCNS worker', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Brain' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canvas' })).toBeVisible();
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
