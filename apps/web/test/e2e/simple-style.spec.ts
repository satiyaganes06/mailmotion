import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

const DESIGNS: [string, string][] = [
  ['Aurora ring', 'GIF 88 × 88'],
  ['Pulse', 'GIF 80 × 80'],
  ['Typewriter', 'GIF 340 × 22'],
  ['Wave banner', 'GIF 460 × 56'],
  ['Neon night', 'GIF 72 × 72'],
  ['Shimmer plate', 'GIF 300 × 44'],
  ['Orbit', 'GIF 84 × 84'],
  ['News ticker', 'GIF 460 × 28'],
  ['Equalizer', 'GIF 64 × 64'],
  ['Ink signature', 'GIF 260 × 64'],
];

test('Simple Style: the Signet page, with one-click hosting of all ten animated images', async ({
  page,
}) => {
  const problems = watchErrors(page);
  await page.goto('/start/');
  await page.getByRole('button', { name: 'Simple Style' }).click();
  await expect(page).toHaveURL(/\/studio\/simple\//);

  // the ten designs, in the reference's order, with its sample details in every preview
  const sections = page.locator('.sg-spec');
  await expect(sections).toHaveCount(10);
  for (const [i, [name, size]] of DESIGNS.entries()) {
    await expect(sections.nth(i).getByRole('heading', { level: 2 })).toHaveText(name);
    await expect(sections.nth(i).locator('.sg-size')).toHaveText(size);
  }
  await expect(sections.first().locator('.sg-sig')).toContainText('Aina Rahman');
  await expect(sections.first().locator('.sg-sig')).toContainText('Product Designer at Lumen Labs');

  // copying before the images are hosted says so instead of copying a broken signature
  await sections.first().getByRole('button', { name: 'Copy HTML source' }).click();
  await expect(page.locator('.sg-toast')).toContainText('Upload the images first');

  // one click: render all ten GIFs in the browser, upload, verify
  await page.getByRole('button', { name: 'Upload images' }).click();
  await expect(page.getByText('All 10 animated images are uploaded')).toBeVisible({
    timeout: 90_000,
  });

  await sections.first().getByRole('button', { name: 'Copy HTML source' }).click();
  await expect(page.locator('.sg-toast')).toContainText('HTML source copied');
  const html = await page.evaluate(() => navigator.clipboard.readText());
  expect(html.startsWith('<!-- Signet: aurora -->\n<table role="presentation"')).toBe(true);
  const src = /<img src="([^"]+)" width="88" height="88" alt="Aina Rahman"/.exec(html)?.[1];
  expect(src).toMatch(/^http:\/\/localhost:8787\/[0-9a-f]{64}\.gif$/);
  // the hosted image really is the animated GIF, at 2x
  const gif = await page.request.get(src!);
  expect(gif.headers()['content-type']).toBe('image/gif');
  const bytes = await gif.body();
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  expect(bytes.readUInt16LE(6)).toBe(176);

  // changing the name only invalidates the three designs that draw it
  await page.getByLabel('Full name').fill('Priya Shah');
  await expect(page.getByText('3 of 10 images changed with your details')).toBeVisible();
  await sections.first().getByRole('button', { name: 'Copy signature' }).click();
  await expect(page.locator('.sg-toast')).toContainText('Upload the images first');
  // …while a design that doesn't draw the name can still be copied
  await sections.nth(3).getByRole('button', { name: 'Copy HTML source' }).click();
  await expect(page.locator('.sg-toast')).toContainText('HTML source copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Priya Shah');

  // the reference's two preview toggles
  await page.getByLabel('Preview as classic Outlook for Windows (first frame only)').check();
  await expect(page.locator('.sg-wrap')).toHaveClass(/sg-static/);
  await page.getByLabel('Outline the animated parts').check();
  await expect(page.locator('.sg-wrap')).toHaveClass(/sg-outline/);

  expect(problems).toEqual([]);
});
