/**
 * Runs before `next dev` / `next build`:
 *  1. copies the bundled fonts into public/fonts (the in-browser renderer fetches them)
 *  2. renders the six designs with the real renderer + serializer into public/gallery and
 *     src/generated/gallery.json, so the landing page shows exactly what the product outputs.
 */
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFromPreset, PRESET_LIST } from '@mailmotion/presets';
import { createNodeEnv } from '@mailmotion/renderer/node';
import { renderSignatureAssets, toSignatureAssets, uniqueFiles } from '@mailmotion/renderer';
import { createCanvas } from '@napi-rs/canvas';
import { createConfig, type SignatureConfigInput } from '@mailmotion/schema';
import { serializeSignature } from '@mailmotion/serializer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontsSrc = join(root, '..', '..', 'packages', 'ink', 'fonts');
const fontsOut = join(root, 'public', 'fonts');
const galleryOut = join(root, 'public', 'gallery');
const genOut = join(root, 'src', 'generated');
for (const d of [fontsOut, galleryOut, genOut]) mkdirSync(d, { recursive: true });

for (const f of readdirSync(fontsSrc))
  if (f.endsWith('.ttf')) copyFileSync(join(fontsSrc, f), join(fontsOut, f));

const PLACEHOLDER = 'https://gallery.mailmotion.invalid';
const env = createNodeEnv({ fontsDir: fontsSrc });

const DETAILS: SignatureConfigInput['details'] = {
  fullName: 'Alex Morgan',
  title: 'Product Designer',
  company: 'Northwind Studio',
  companyUrl: 'https://example.com',
  phones: [{ label: 'Mobile', number: '+1 415 555 0134' }],
  email: 'alex@example.com',
  websites: [{ url: 'https://example.com' }],
};
const SOCIALS: SignatureConfigInput['socials'] = {
  items: [
    { platform: 'website', url: 'https://example.com' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/example' },
    { platform: 'github', url: 'https://github.com/example' },
    { platform: 'x', url: 'https://x.com/example' },
    { platform: 'instagram', url: 'https://instagram.com/example' },
  ],
};

const gallery: Record<string, { name: string; bestFor: string; html: string; chars: number }> = {};
const written = new Set<string>();

for (const preset of PRESET_LIST) {
  const base = createFromPreset(preset.id, DETAILS);
  const cfg = createConfig({ ...base, socials: SOCIALS } as SignatureConfigInput);
  const rendered = await renderSignatureAssets(cfg, env);
  for (const [name, r] of uniqueFiles(rendered)) {
    if (!written.has(name)) {
      writeFileSync(join(galleryOut, name), r.bytes);
      written.add(name);
    }
  }
  const { html, chars, issues } = serializeSignature(cfg, toSignatureAssets(rendered, PLACEHOLDER));
  if (issues.length) throw new Error(`Gallery ${preset.id} failed lint: ${JSON.stringify(issues)}`);
  gallery[preset.id] = {
    name: preset.name,
    bestFor: preset.bestFor,
    html: html.replaceAll(`${PLACEHOLDER}/`, '/gallery/'),
    chars,
  };
  console.log(`gallery: ${preset.name} ${chars} chars, ${rendered.length} images`);
}

writeFileSync(join(genOut, 'gallery.json'), JSON.stringify(gallery));

// App icons (PNG for the manifest and iOS home screen). Same mark as public/icon.svg.
const iconsOut = join(root, 'public', 'icons');
mkdirSync(iconsOut, { recursive: true });
for (const [size, maskable] of [
  [192, false],
  [512, false],
  [512, true],
  [180, false],
] as const) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#b34700');
  g.addColorStop(1, '#e2793d');
  ctx.fillStyle = g;
  if (maskable) ctx.fillRect(0, 0, size, size);
  else {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.25);
    ctx.fill();
  }
  const k = (maskable ? 0.62 : 1) * (size / 32);
  ctx.translate(maskable ? size * 0.19 : 0, maskable ? size * 0.19 : 0);
  ctx.scale(k, k);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new (await import('@napi-rs/canvas')).Path2D('M7 21c2-9 5-9 6-3s3 4 4-2 3-6 4 1'));
  writeFileSync(
    join(iconsOut, `icon-${size}${maskable ? '-maskable' : ''}.png`),
    c.toBuffer('image/png'),
  );
}
console.log(`prepare-assets: ${written.size} gallery files, fonts copied`);
