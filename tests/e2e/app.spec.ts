import { expect, test } from '@playwright/test';

test('boots the Brain-first split workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Brain' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canvas' })).toBeVisible();
  await expect(page.getByText('MaleCNS circuit: not loaded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled();
});
