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

test('Simple Style: copying a design uploads just that design’s animated image', async ({
  page,
}) => {
  const problems = watchErrors(page);
  let uploads = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/upload')) uploads++;
  });
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
  const aurora = sections.first();
  await expect(aurora.locator('.sg-sig')).toContainText('Product Designer at Lumen Labs');

  // browsing and editing uploads nothing
  await expect(page.getByText('Nothing is uploaded while you browse or edit')).toBeVisible();
  await aurora.hover();
  await page.getByLabel('Job title').fill('Lead Product Designer');
  expect(uploads).toBe(0);

  // copying renders and uploads just this design, then copies a signature that points at it
  await aurora.getByRole('button', { name: 'Copy HTML source' }).click();
  await expect(page.locator('.sg-toast')).toContainText('HTML source copied');
  expect(uploads).toBe(1);
  const html = await page.evaluate(() => navigator.clipboard.readText());
  expect(html.startsWith('<!-- Signet: aurora -->\n<table role="presentation"')).toBe(true);
  const src = /<img src="([^"]+)" width="88" height="88" alt="Aina Rahman"/.exec(html)?.[1];
  expect(src).toMatch(/^http:\/\/localhost:8787\/[0-9a-f]{64}\.gif$/);
  const gif = await page.request.get(src!);
  expect(gif.headers()['content-type']).toBe('image/gif');
  expect((await gif.body()).readUInt16LE(6)).toBe(176); // rendered at 2x
  await expect(aurora.locator('.sg-size')).toHaveClass(/\bok\b/);
  await expect(page.getByText('1 of 10 designs are hosted')).toBeVisible();

  // copying again, or after editing something the design doesn't draw, re-uses the upload
  await aurora.getByRole('button', { name: 'Copy signature' }).click();
  await expect(page.locator('.sg-toast')).toContainText('Signature copied');
  await page.getByLabel('Job title').fill('Head of Design');
  await aurora.getByRole('button', { name: 'Copy HTML source' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Head of Design');
  expect(uploads).toBe(1);

  // editing something it draws (the name → the initials) needs one new upload on the next copy
  await page.getByLabel('Full name').fill('Priya Shah');
  await expect(aurora.locator('.sg-size')).not.toHaveClass(/\bok\b/);
  await aurora.getByRole('button', { name: 'Copy HTML source' }).click();
  // (the previous copy's identical toast may still be showing, so wait on the clipboard itself)
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Priya Shah');
  expect(uploads).toBe(2);

  // the optional bulk path still hosts everything that isn't hosted yet
  await page.getByRole('button', { name: 'Upload all 9 now' }).click();
  await expect(page.getByText('All 10 animated images are uploaded')).toBeVisible({
    timeout: 90_000,
  });
  expect(uploads).toBe(11);

  // the reference's two preview toggles
  await page.getByLabel('Preview as classic Outlook for Windows (first frame only)').check();
  await expect(page.locator('.sg-wrap')).toHaveClass(/sg-static/);
  await page.getByLabel('Outline the animated parts').check();
  await expect(page.locator('.sg-wrap')).toHaveClass(/sg-outline/);

  expect(problems).toEqual([]);
});
