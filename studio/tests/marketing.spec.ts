import { expect, test } from '@playwright/test';

test('marketing landmarks and preview dates reflect the selected day', async ({ page }) => {
  await page.goto('/');
  const main = page.getByRole('main');
  await expect(main.locator('#contact')).toHaveCount(1);
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Initial consultation' })).toBeVisible();
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.getByText('No appointments on this day.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Initial consultation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Initial consultation' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Example workspace' }).getByRole('button', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next day', exact: true })).toHaveCount(0);
});
