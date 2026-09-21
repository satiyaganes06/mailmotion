import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('landing page shows six real designs and links to the builder and docs', async ({ page }) => {
  const problems = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('actually render');
  await expect(page.locator('.g-card')).toHaveCount(6);
  // every gallery image loads
  const broken = await page.$$eval(
    '.g-stage img',
    (imgs) =>
      imgs.filter(
        (i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0,
      ).length,
  );
  expect(broken).toBe(0);
  await page.getByRole('link', { name: 'Build my signature' }).click();
  await expect(page).toHaveURL(/\/studio\//);
  expect(problems).toEqual([]);
});

test('docs and compatibility pages render, and the compat page does not overclaim', async ({
  page,
}) => {
  await page.goto('/docs/');
  await expect(page).toHaveURL(/\/docs\/getting-started\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting started');
  await page.getByRole('link', { name: 'Install guides' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Install guides');
  await page.goto('/compat/');
  await expect(page.locator('.prose')).toContainText('not yet verified on real devices');
});

test('phone page rejects garbage links and is noindex', async ({ page }) => {
  await page.goto('/phone/#d=not-a-real-payload');
  await expect(page.locator('.notice.bad')).toContainText('not valid');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
});
