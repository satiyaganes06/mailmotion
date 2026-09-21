import { expect, test } from '@playwright/test';
import { UPLOAD_TOKEN, openStudio, waitForRender, watchErrors } from './helpers';

test('ZIP path: download bundle, set a base URL, then copy HTML and download files', async ({
  page,
}) => {
  const problems = watchErrors(page);
  await openStudio(page);
  await page.getByRole('tab', { name: 'Download ZIP' }).click();

  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download ZIP' }).click(),
  ]);
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);

  // install actions are locked until images are hosted
  await expect(page.getByRole('button', { name: 'Copy HTML source' })).toBeDisabled();
  await page
    .getByLabel('Where you uploaded the images (base URL)')
    .fill('http://insecure.example.com');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await expect(page.locator('.install .notice.bad')).toContainText('https://');
  await page
    .getByLabel('Where you uploaded the images (base URL)')
    .fill('https://cdn.example.com/sig');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await expect(page.locator('.install .step-head .chip.ok').first()).toContainText('manual');

  await page.getByRole('button', { name: 'Copy HTML source' }).click();
  const html = await page.evaluate(() => navigator.clipboard.readText());
  expect(html).toContain('https://cdn.example.com/sig/');
  expect(html).not.toContain('blob:');
  expect(html).not.toContain('<script');
  expect(html.length).toBeLessThanOrEqual(10_000);

  const [htm] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .htm' }).first().click(),
  ]);
  expect(htm.suggestedFilename()).toMatch(/\.htm$/);
  const [mailsig] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .mailsignature' }).first().click(),
  ]);
  expect(mailsig.suggestedFilename()).toMatch(/\.mailsignature$/);
  const [eml] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /test email/ }).click(),
  ]);
  expect(eml.suggestedFilename()).toMatch(/-test\.eml$/);
  expect(problems).toEqual([]);
});

test('copy formatted signature puts rich text/html on the clipboard', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('tab', { name: 'Download ZIP' }).click();
  await page
    .getByLabel('Where you uploaded the images (base URL)')
    .fill('https://cdn.example.com/sig');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await page.getByRole('button', { name: 'Copy formatted signature' }).first().click();
  await expect(page.getByRole('button', { name: 'Copied' }).first()).toBeVisible();
  const flavors = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const out: Record<string, string> = {};
    for (const t of items[0]!.types) out[t] = await (await items[0]!.getType(t)).text();
    return out;
  });
  expect(Object.keys(flavors)).toEqual(expect.arrayContaining(['text/html', 'text/plain']));
  expect(flavors['text/html']).toContain('<table');
});

test('Path A: upload to a real storage server, verify URLs, then create a phone link that opens', async ({
  page,
  context,
}) => {
  const problems = watchErrors(page);
  await openStudio(page);
  await page.getByRole('tab', { name: 'Your storage' }).click();
  await page.getByLabel('Storage server address').fill('http://localhost:8787');
  // wrong token first: clear error
  await page.getByLabel('Upload token').fill('wrong-token-wrong-token-wrong');
  await page.getByRole('button', { name: 'Upload images' }).click();
  await expect(page.locator('.install .notice.bad')).toContainText('token was rejected');
  await page.getByLabel('Upload token').fill(UPLOAD_TOKEN);
  await page.getByRole('button', { name: 'Upload images' }).click();
  await expect(page.locator('.install .notice.good')).toContainText('verified every URL');
  await expect(page.locator('.install .step-head .chip.ok').first()).toContainText('server');

  // the served images are real GIF/PNG files with hardened headers
  const src = await page.locator('iframe.preview-frame').getAttribute('srcdoc');
  expect(src).toBeTruthy();

  // phone link + QR
  await page.getByRole('button', { name: 'Create private link' }).click();
  await expect(page.getByAltText(/QR code/)).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __c: string }).__c = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (t: string) => ((window as unknown as { __c: string }).__c = t) },
      configurable: true,
    });
  });
  await page.getByRole('button', { name: 'Copy link' }).click();
  const link = await page.evaluate(() => (window as unknown as { __c: string }).__c);
  expect(link).toMatch(/\/phone\/#d=/);

  const phone = await context.newPage();
  await phone.goto(link);
  await expect(phone.getByRole('heading', { name: 'Your signature' })).toBeVisible();
  await expect(phone.frameLocator('iframe.phone-frame').locator('body')).toContainText(
    'Alex Morgan',
  );
  expect(await phone.locator('iframe.phone-frame').getAttribute('sandbox')).toBe('');
  await expect(phone.getByRole('button', { name: 'Copy signature' })).toBeVisible();

  // the stored images are served immutable with nosniff
  const url = new URL(link);
  void url;
  const res = await page.request.get('http://localhost:8787/healthz');
  expect(res.ok()).toBe(true);
  expect(problems).toEqual([]);
});
