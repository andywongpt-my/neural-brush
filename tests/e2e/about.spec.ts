import { expect, test } from '@playwright/test';

type AboutTestWindow = Window & {
  __NEURAL_BRUSH_TEST__?: {
    editedChecksum(): number | null;
  };
};

test('About / Science discloses scientific and privacy boundaries without resetting artwork', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  const readChecksum = () =>
    page.evaluate(
      () => (window as AboutTestWindow).__NEURAL_BRUSH_TEST__?.editedChecksum() ?? null,
    );

  await expect.poll(readChecksum).not.toBeNull();
  const before = await readChecksum();
  await expect.poll(readChecksum, { timeout: 4_000 }).not.toBe(before);

  await page.getByRole('button', { name: 'About / Science' }).click();
  const dialog = page.getByRole('dialog', { name: 'About Neural Brush' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('male-cns:v1.0');
  await expect(dialog).toContainText('simplified modeling assumptions');
  await expect(dialog).toContainText('synthetic sensory adapter');
  await expect(dialog).toContainText('artistic mappings');
  await expect(dialog).toContainText('processed locally in the browser');
  await expect(dialog).toContainText('Brain Presets');
  await expect(dialog).toContainText('CC BY 4.0');
  await expect(dialog).toContainText('MIT');

  const checksumWhileOpen = await readChecksum();
  expect(checksumWhileOpen).not.toBeNull();
  await expect(page.getByText('brush-image.png')).toBeVisible();

  await page.getByRole('button', { name: 'Close About' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('brush-image.png')).toBeVisible();
  await expect(page.locator('canvas.photo-canvas')).toBeVisible();

  const afterClose = await readChecksum();
  await expect.poll(readChecksum, { timeout: 4_000 }).not.toBe(afterClose);
});
