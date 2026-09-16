import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';

async function downloadFromButton(page: Page, name: string): Promise<Download> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name }).click();
  return pending;
}

async function downloadBytes(page: Page, name: string): Promise<Buffer> {
  const download = await downloadFromButton(page, name);
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

async function selectNeuronByType(page: Page, type: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Neuron' }).evaluate(
    (element, requestedType) => {
      const select = element as HTMLSelectElement;
      const match = Array.from(select.options).find((option) =>
        option.textContent?.includes(requestedType),
      );
      if (!match) throw new Error(`${requestedType} neuron option is missing`);
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
    type,
  );
}

async function setRange(page: Page, name: string, value: string): Promise<void> {
  await page.getByRole('slider', { name }).evaluate((element, nextValue) => {
    const slider = element as HTMLInputElement;
    slider.value = nextValue;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('V1 acceptance: live edit, Brain modulation, exports, and share restore', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'About / Science' })).toBeVisible();

  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();

  const earlyArtwork = await downloadBytes(page, 'Export PNG');
  await page.waitForTimeout(800);
  const laterArtwork = await downloadBytes(page, 'Export PNG');
  expect(earlyArtwork.equals(laterArtwork)).toBe(false);

  await selectNeuronByType(page, 'DNa01');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('MaleCNS circuit: paused')).toBeVisible();
  const turnBefore = await page.getByTestId('brain-turn').textContent();
  await setRange(page, 'Stimulation', '1');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible();
  await expect
    .poll(async () => page.getByTestId('brain-turn').textContent(), { timeout: 5_000 })
    .not.toBe(turnBefore);

  const finalPngDownload = await downloadFromButton(page, 'Export PNG');
  expect(finalPngDownload.suggestedFilename()).toBe('neural-brush.png');
  const finalPngPath = await finalPngDownload.path();
  expect(finalPngPath).not.toBeNull();
  const finalPng = await readFile(finalPngPath!);
  expect(finalPng.length).toBeGreaterThan(32);
  expect(Array.from(finalPng.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(finalPng.readUInt32BE(16)).toBe(128);
  expect(finalPng.readUInt32BE(20)).toBe(96);

  const brainDownload = await downloadFromButton(page, 'Export Brain');
  expect(brainDownload.suggestedFilename()).toBe('neural-brush-preset.neuralbrush.json');
  const brainPath = await brainDownload.path();
  expect(brainPath).not.toBeNull();
  const brainText = await readFile(brainPath!, 'utf-8');
  const brainJson = JSON.parse(brainText) as Record<string, unknown>;
  expect(brainText).not.toContain('brush-image.png');
  expect(brainText).not.toContain('imageName');
  expect(brainJson.dataset).toBe('male-cns:v1.0');

  await page.getByRole('button', { name: 'Share Brain' }).click();
  const sharedUrl = await page.getByLabel('Shared Brain link').inputValue();
  expect(sharedUrl).toContain('#preset=');
  expect(sharedUrl).not.toContain('brush-image.png');

  const restored = await context.newPage();
  await restored.goto(sharedUrl);
  await expect(restored.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 15_000 });
  await expect(restored.getByText('No photo loaded')).toBeVisible();
  await expect(restored.getByText('brush-image.png')).toHaveCount(0);
  await selectNeuronByType(restored, 'DNa01');
  await expect(restored.getByRole('slider', { name: 'Stimulation' })).toHaveValue('1');

  await restored.getByRole('button', { name: 'About / Science' }).click();
  await expect(restored.getByRole('dialog', { name: 'About Neural Brush' })).toContainText(
    'simplified modeling assumptions',
  );
});
