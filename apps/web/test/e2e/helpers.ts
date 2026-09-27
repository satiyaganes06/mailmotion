import { expect, type Page } from '@playwright/test';

export const UPLOAD_TOKEN = 'e2e-upload-token-0123456789abcdef';

/** Fail the test on CSP violations and uncaught page errors (the production build ships a strict CSP). */
export function watchErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|violates the following/i.test(t)) problems.push(`csp: ${t}`);
  });
  return problems;
}

/** Open the builder, skipping the first-run quick start. */
export async function openStudio(page: Page) {
  await page.goto('/studio/');
  // wait for hydration + the saved-draft lookup; only then do we know whether the quick start shows
  await expect(page.locator('.saved')).toContainText('Saved');
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) await dialog.getByRole('button', { name: 'Skip' }).click();
  await expect(dialog).toHaveCount(0);
  await waitForRender(page);
}

/** The preview iframe is present and the worker has finished rendering (meters show GIF sizes). */
export async function waitForRender(page: Page) {
  await expect(page.locator('iframe.preview-frame')).toBeVisible();
  await expect(page.locator('.meter-head', { hasText: 'Avatar GIF' })).toBeVisible();
  await expect(page.locator('.chip.live', { hasText: 'rendering' })).toHaveCount(0);
}

export const previewText = (page: Page) =>
  page.frameLocator('iframe.preview-frame').locator('body');

/** Open an editor panel (`#details`, `#extras`, ...) only if it is closed. */
export async function openPanel(page: Page, id: string) {
  const panel = page.locator(`details#${id}`);
  if ((await panel.getAttribute('open')) === null) await panel.locator('summary').click();
  await expect(panel).toHaveAttribute('open', '');
}
