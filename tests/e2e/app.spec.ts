import { expect, test } from '@playwright/test';

test('boots the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
});
