import { expect, test, type Locator, type Page } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
}

async function bootMobile(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
}

test('mobile exposes Brush Mode and core V1 controls without hover', async ({ page }) => {
  await bootMobile(page);

  const upload = page.getByLabel('Choose photo');
  const autonomous = page.getByRole('button', { name: 'Autonomous' });
  const resetBrain = page.getByRole('button', { name: 'Reset Brain' });
  const brushMode = page.getByRole('combobox', { name: 'Brush Mode' });
  const exportPNG = page.getByRole('button', { name: 'Export PNG' });

  await expect(upload).toBeAttached();
  await expect(autonomous).toBeVisible();
  await expect(resetBrain).toBeVisible();
  await expect(brushMode).toBeVisible();
  await expect(brushMode).toHaveValue('blend');
  await expect(exportPNG).toBeVisible();

  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();
  await expect(exportPNG).toBeEnabled();

  await brushMode.selectOption('smear');
  await expect(brushMode).toHaveValue('smear');
});

test('mobile stacks Brain above Canvas and keeps core actions as touch targets', async ({ page }) => {
  await bootMobile(page);

  const brain = page.getByRole('region', { name: 'Brain', exact: true });
  const canvas = page.getByRole('region', { name: 'Canvas', exact: true });
  const brainBox = await brain.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(brainBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.y).toBeGreaterThanOrEqual(brainBox!.y + brainBox!.height - 1);
  expect(canvasBox!.height).toBeGreaterThanOrEqual(280);

  await expectTouchTarget(page.getByRole('button', { name: 'Autonomous' }));
  await expectTouchTarget(page.getByRole('button', { name: 'Reset Brain' }));
  await expectTouchTarget(page.getByRole('button', { name: 'Export PNG' }));
});

test('mobile starts neuron inspector disclosure sections collapsed', async ({ page }) => {
  await bootMobile(page);

  const source = page.locator('details.inspector-section').filter({ hasText: 'Source facts' });
  const simulation = page
    .locator('details.inspector-section')
    .filter({ hasText: 'Simulation controls' });

  await expect(source).toBeVisible();
  await expect(simulation).toBeVisible();
  await expect(source).not.toHaveAttribute('open', '');
  await expect(simulation).not.toHaveAttribute('open', '');

  await source.locator('summary').click();
  await expect(source).toHaveAttribute('open', '');
  await expect(page.getByRole('combobox', { name: 'Neuron' })).toBeVisible();
});
