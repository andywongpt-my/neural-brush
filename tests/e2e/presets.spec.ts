import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

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

test('shares and restores a Brain Preset without restoring the source image', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  await selectNeuronByType(page, 'DNa01');
  await setRange(page, 'Stimulation', '0.37');
  await setRange(page, 'Connection modulation', '0.63');

  await page.getByRole('button', { name: 'Share Brain' }).click();
  const shareLink = page.getByLabel('Shared Brain link');
  await expect(shareLink).toBeVisible();
  const sharedUrl = await shareLink.inputValue();
  expect(sharedUrl).toContain('#preset=');
  expect(sharedUrl).not.toContain('brush-image.png');

  const restored = await context.newPage();
  await restored.goto(sharedUrl);
  await expect(restored.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await expect(restored.getByText('No photo loaded')).toBeVisible();
  await expect(restored.getByText('brush-image.png')).toHaveCount(0);

  await selectNeuronByType(restored, 'DNa01');
  await expect(restored.getByRole('slider', { name: 'Stimulation' })).toHaveValue('0.37');
  await expect(restored.getByRole('slider', { name: 'Connection modulation' })).toHaveValue('0.63');
});

test('exports, resets, and imports the same Brain Preset without photo data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  await selectNeuronByType(page, 'DNa01');
  await setRange(page, 'Stimulation', '0.44');
  await setRange(page, 'Connection modulation', '1.27');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Brain' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('neural-brush-preset.neuralbrush.json');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const exportedText = await readFile(downloadPath!, 'utf8');
  expect(exportedText).not.toContain('brush-image.png');
  expect(exportedText).not.toContain('imageName');
  const exportedJson = JSON.parse(exportedText) as Record<string, unknown>;
  expect(Object.keys(exportedJson).sort()).toEqual([
    'brush',
    'circuit',
    'dataset',
    'gains',
    'modulation',
    'schema',
    'seed',
  ]);

  await page.getByRole('button', { name: 'Reset Brain' }).click();
  await expect(page.getByRole('slider', { name: 'Stimulation' })).toHaveValue('0');
  await expect(page.getByRole('slider', { name: 'Connection modulation' })).toHaveValue('1');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  await page.getByLabel('Import Brain file').setInputFiles(downloadPath!);
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await selectNeuronByType(page, 'DNa01');
  await expect(page.getByRole('slider', { name: 'Stimulation' })).toHaveValue('0.44');
  await expect(page.getByRole('slider', { name: 'Connection modulation' })).toHaveValue('1.27');
  await expect(page.getByText('brush-image.png')).toBeVisible();
});

test('invalid shared preset warns, can be dismissed, and leaves a neutral usable brain', async ({
  page,
}) => {
  await page.goto('/#preset=bad+');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });

  const warning = page.getByRole('alert', { name: 'Preset warning' });
  await expect(warning).toContainText('Unable to restore shared Brain preset');
  await page.getByRole('button', { name: 'Dismiss preset warning' }).click();
  await expect(warning).toBeHidden();

  await expect(page.getByRole('slider', { name: 'Stimulation' })).toHaveValue('0');
  await expect(page.getByRole('slider', { name: 'Inhibition' })).toHaveValue('0');
});
