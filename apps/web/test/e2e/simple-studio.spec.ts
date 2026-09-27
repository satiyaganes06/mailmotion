import { expect, test } from '@playwright/test';
import { openSimpleStudio, previewText, waitForRender, watchErrors } from './helpers';

test('Simple Style: switch designs, edit fields, change the one accent colour, and upload for real', async ({
  page,
}) => {
  const problems = watchErrors(page);
  await openSimpleStudio(page);

  // Aurora (the default) shows company/phone/email/website — no status line
  await expect(page.getByLabel('Company')).toBeVisible();
  await expect(page.getByLabel('Status line')).toHaveCount(0);
  await expect(previewText(page)).toContainText('Aina Rahman');

  // Switch to Pulse: the field set changes to include a status line, and drops phone/website
  await page.getByRole('radio', { name: 'Pulse' }).click();
  await waitForRender(page);
  await expect(page.getByLabel('Status line')).toBeVisible();
  await expect(page.getByLabel('Phone')).toHaveCount(0);

  // Editing the name updates the preview
  await page.getByLabel('Full name').fill('Priya Shah');
  await waitForRender(page);
  await expect(previewText(page)).toContainText('Priya Shah');

  // One accent colour input drives every design (no separate palette step)
  await expect(page.getByLabel('Accent', { exact: true })).toBeVisible();
  await expect(page.locator('.palettes')).toHaveCount(0);

  // Switch to a no-avatar design (Typewriter) and confirm the avatar disappears
  await page.getByRole('radio', { name: 'Typewriter' }).click();
  await expect(page.locator('.preset.on')).toContainText('Typewriter');
  await waitForRender(page);
  await expect(async () => {
    const src = await page.locator('iframe.preview-frame').getAttribute('srcdoc');
    expect(src).not.toMatch(/alt="[A-Z]{1,2}" style="display:block;border:0" \/>/);
  }).toPass({ timeout: 5000 });

  // The real one-click upload flow (same as Custom Style) works from here too
  await page.getByRole('button', { name: 'Upload images' }).click();
  await expect(page.locator('.install .notice.good')).toContainText('verified every URL');

  await page.getByRole('button', { name: 'Copy formatted signature' }).first().click();
  await expect(page.getByRole('button', { name: 'Copied' }).first()).toBeVisible();

  expect(problems).toEqual([]);
});
