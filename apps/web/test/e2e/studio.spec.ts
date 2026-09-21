import { expect, test } from '@playwright/test';
import { openPanel, openStudio, previewText, waitForRender, watchErrors } from './helpers';

test('first run: quick start creates a signature in a few clicks', async ({ page }) => {
  const problems = watchErrors(page);
  await page.goto('/studio/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('radio', { name: /Wave/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Full name').fill('Zoë Ünal');
  await dlg.getByLabel('Job title').fill('Head of Design');
  await dlg.getByLabel('Company').fill('Fjord & Co');
  await page.getByRole('button', { name: 'Create my signature' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitForRender(page);
  await expect(previewText(page)).toContainText('Zoë Ünal');
  await expect(previewText(page)).toContainText('Fjord & Co'); // escaped ampersand renders as text
  await expect(page.locator('#design .preset.on')).toContainText('Wave');
  expect(problems).toEqual([]);
});

test('live editing updates the preview, meters and supports undo/redo; drafts persist', async ({
  page,
}) => {
  await openStudio(page);
  await openPanel(page, 'details');
  const name = page.locator('#details').getByLabel('Full name');
  await name.fill('Grace Hopper');
  await expect(previewText(page)).toContainText('Grace Hopper');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(previewText(page)).toContainText('Alex Morgan');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(previewText(page)).toContainText('Grace Hopper');
  // meters
  await expect(page.locator('.meter-head', { hasText: 'HTML characters' })).toContainText(
    '/ 10,000',
  );
  // reload keeps the draft
  await expect(page.locator('.saved')).toContainText('Saved');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitForRender(page);
  await expect(previewText(page)).toContainText('Grace Hopper');
});

test('design, remix, banner and client preview switching', async ({ page }) => {
  await openStudio(page);
  await page.locator('#design .preset', { hasText: 'Neon' }).click();
  await waitForRender(page);
  await expect(page.locator('.preset.on')).toContainText('Neon');
  // remix: neon avatar on the stacked layout
  await page.locator('#rx-layout').selectOption('stacked');
  await waitForRender(page);
  await expect(page.locator('#rx-layout')).toHaveValue('stacked');
  // enable a wave banner from the extras panel
  await openPanel(page, 'extras');
  await page.getByLabel('Show a banner').check({ force: true });
  await expect(page.locator('.meter-head', { hasText: 'Banner GIF' })).toBeVisible();
  // client switcher: classic Outlook shows frame 1 (png blobs instead of gifs)
  await page.locator('#pv-client').selectOption('outlook-classic');
  await expect(page.locator('.preview-note')).toContainText('Frame 1');
  await page.locator('.preview-bar').getByRole('radio', { name: 'Phone' }).click();
  await page.locator('.preview-bar').getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('.stage-frame')).toHaveClass(/phone/);
});

test('an invalid field shows an error and the preview keeps the last good version', async ({
  page,
}) => {
  await openStudio(page);
  await openPanel(page, 'details');
  const email = page.locator('#details input[type=email]');
  await email.fill('not-an-email');
  await expect(page.locator('.field-error')).toContainText('valid email');
  await expect(page.locator('.notice.warn', { hasText: 'last valid' })).toBeVisible();
  await expect(previewText(page)).toContainText('Alex Morgan');
  await email.fill('alex@example.com');
  await expect(page.locator('.field-error')).toHaveCount(0);
});

test('a hostile name is rendered inert everywhere', async ({ page }) => {
  const problems = watchErrors(page);
  await openStudio(page);
  await openPanel(page, 'details');
  await page
    .locator('#details')
    .getByLabel('Full name')
    .fill('<img src=x onerror=alert(1)>"><script>alert(2)</script>');
  await expect(previewText(page)).toContainText('<img src=x onerror=alert(1)>');
  const html = await page.locator('iframe.preview-frame').getAttribute('srcdoc');
  expect(html).not.toContain('<script>alert');
  expect(html).not.toMatch(/<img src=x/);
  expect(problems).toEqual([]);
});
