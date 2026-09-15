import { expect, test } from '@playwright/test';

test('boots the Brain-first split workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Brain' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canvas' })).toBeVisible();
  await expect(page.getByText('MaleCNS circuit: not loaded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled();
});

test('loads a local image into the Three.js canvas', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/test-image.png');

  await expect(page.getByText('test-image.png')).toBeVisible();
  await expect(page.locator('canvas.photo-canvas')).toBeVisible();
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
