import { expect, test } from '@playwright/test';

test('Precision entry links and responsive preview lead into the real demo', async ({ page }) => {
  await page.goto('/');
  const main = page.getByRole('main');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Your practice,in one place.');
  await expect(main.getByRole('link', { name: 'Open Studio', exact: true })).toHaveAttribute('href', '/app');
  await expect(page.getByRole('link', { name: 'About Studio', exact: true })).toHaveAttribute('href', 'https://www.oceanheart.ai/studio');
  await expect(page.getByRole('link', { name: 'Talk to Rick', exact: true })).toHaveAttribute('href', /^mailto:rick@oceanheart.ai/);
  const image = main.getByRole('img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const mobile = page.viewportSize()!.width <= 600;
  expect(await image.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(mobile ? 'precision-today-mobile.webp' : 'precision-today.webp');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await main.getByRole('link', { name: 'Explore the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/app\?demo=1$/);
  await expect(page.getByRole('button', { name: 'Find anything', exact: true })).toBeVisible();
});
