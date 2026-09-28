// node render.mjs stills 0.5 3.2 ...   -> ../stills/t_<time>.jpg (1920x1080)
// node render.mjs frames [workers]      -> ../frames/f_00000.jpg ... (3840x2160, supersampled later)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PAGE_URL = 'http://127.0.0.1:4700/index.html';
const FPS = 30;
const [mode, ...rest] = process.argv.slice(2);
const root = new URL('..', import.meta.url).pathname;

async function openPage(browser, dpr) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  return page;
}

async function shot(page, t, path, quality) {
  await page.evaluate((t) => window.renderAt(t), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path, type: 'jpeg', quality });
}

const browser = await chromium.launch();
if (mode === 'stills') {
  const out = root + 'stills/';
  mkdirSync(out, { recursive: true });
  const page = await openPage(browser, 1);
  for (const t of rest.map(Number)) await shot(page, t, `${out}t_${t.toFixed(2)}.jpg`, 90);
  console.log('stills done');
} else {
  const workers = Number(rest[0] || 4);
  const out = root + 'frames/';
  mkdirSync(out, { recursive: true });
  const dur = 24.2;
  const total = Math.round(dur * FPS);
  const per = Math.ceil(total / workers);
  const started = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage(browser, 2);
    for (let f = w * per; f < Math.min(total, (w + 1) * per); f++) {
      await shot(page, f / FPS, `${out}f_${String(f).padStart(5, '0')}.jpg`, 94);
      if (++done % 60 === 0) console.log(`${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  }));
  console.log(`frames done: ${total} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
await browser.close();
