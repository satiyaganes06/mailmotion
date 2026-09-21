import { expect, test } from '@playwright/test';
import { previewText, waitForRender, watchErrors } from './helpers';

test('builder is usable on a phone: tabs switch between edit, preview and install', async ({
  page,
}) => {
  const problems = watchErrors(page);
  await page.goto('/studio/');
  await expect(page.locator('.studio-bar')).toBeVisible();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('.tabs')).toBeVisible();
  await expect(page.locator('.editor')).toBeVisible();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await waitForRender(page);
  await expect(previewText(page)).toContainText('Alex Morgan');
  await expect(page.locator('.editor')).toBeHidden();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(page.locator('.install')).toBeVisible();
  // no horizontal page scroll (16px gutter layout)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(problems).toEqual([]);
});

test('landing page has no horizontal scroll on a phone', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
