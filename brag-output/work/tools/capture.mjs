import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../capture/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });

async function grab(url, name, prep) {
  await page.goto(`http://localhost:3200${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (prep) await prep();
  const html = await page.evaluate(() => {
    for (const el of document.querySelectorAll('input, textarea, select')) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) el.setAttribute('checked', '');
      } else if (el.tagName === 'SELECT') {
        for (const o of el.options) if (o.selected) o.setAttribute('selected', '');
      } else el.setAttribute('value', el.value);
    }
    const body = document.body.cloneNode(true);
    body.querySelectorAll('script, next-route-announcer, nextjs-portal').forEach((n) => n.remove());
    return `<html lang="en" ${[...document.documentElement.attributes].map((a) => `${a.name}="${a.value}"`).join(' ')}>\n<body class="${document.body.className}">${body.innerHTML}</body></html>`;
  });
  writeFileSync(`${OUT}${name}.html`, html);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
  console.log(name, html.length);
}

await grab('/', 'landing');
await grab('/start/', 'start');
await grab('/studio/simple/', 'simple');
await grab('/studio/', 'custom', async () => {
  const skip = page.getByRole('button', { name: /skip|close|later/i });
  if (await skip.count()) await skip.first().click().catch(() => {});
  await page.waitForTimeout(800);
});
await browser.close();
