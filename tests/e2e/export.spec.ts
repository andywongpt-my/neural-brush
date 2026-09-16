import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';

async function downloadFromButton(page: Page, name: string): Promise<Download> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name }).click();
  return downloadPromise;
}

test('downloads edited artwork as original-size PNG and JPEG files', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });

  const pngButton = page.getByRole('button', { name: 'Export PNG' });
  const jpegButton = page.getByRole('button', { name: 'Export JPEG' });
  await expect(pngButton).toBeDisabled();
  await expect(jpegButton).toBeDisabled();

  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();
  await expect(pngButton).toBeEnabled();
  await expect(jpegButton).toBeEnabled();

  await page.waitForTimeout(250);

  const pngDownload = await downloadFromButton(page, 'Export PNG');
  expect(pngDownload.suggestedFilename()).toBe('neural-brush.png');
  const pngPath = await pngDownload.path();
  expect(pngPath).not.toBeNull();
  const pngBytes = await readFile(pngPath!);
  expect(pngBytes.length).toBeGreaterThan(32);
  expect(Array.from(pngBytes.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(pngBytes.readUInt32BE(16)).toBe(128);
  expect(pngBytes.readUInt32BE(20)).toBe(96);

  const jpegDownload = await downloadFromButton(page, 'Export JPEG');
  expect(jpegDownload.suggestedFilename()).toBe('neural-brush.jpg');
  const jpegPath = await jpegDownload.path();
  expect(jpegPath).not.toBeNull();
  const jpegBytes = await readFile(jpegPath!);
  expect(jpegBytes.length).toBeGreaterThan(16);
  expect(Array.from(jpegBytes.subarray(0, 2))).toEqual([0xff, 0xd8]);
  expect(Array.from(jpegBytes.subarray(-2))).toEqual([0xff, 0xd9]);

  await expect(page.getByText('brush-image.png')).toBeVisible();
  await expect(page.locator('canvas.photo-canvas')).toBeVisible();
});

test('records and downloads a WebM process video from the visible photo canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  const recordButton = page.getByRole('button', { name: 'Record Process' });
  const stopButton = page.getByRole('button', { name: 'Stop Recording' });
  const downloadButton = page.getByRole('button', { name: 'Download Recording' });

  await expect(recordButton).toBeEnabled();
  await expect(stopButton).toBeDisabled();
  await expect(downloadButton).toBeDisabled();

  await recordButton.click();
  await expect(recordButton).toBeDisabled();
  await expect(stopButton).toBeEnabled();
  await expect(page.getByText('Recording process…')).toBeVisible();

  await page.waitForTimeout(900);
  await stopButton.click();
  await expect(page.getByText('Recording ready to download.')).toBeVisible({ timeout: 5_000 });
  await expect(downloadButton).toBeEnabled();

  const download = await downloadFromButton(page, 'Download Recording');
  expect(download.suggestedFilename()).toBe('neural-brush-process.webm');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const bytes = await readFile(downloadPath!);
  expect(bytes.length).toBeGreaterThan(128);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);

  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Export JPEG' })).toBeEnabled();
});
