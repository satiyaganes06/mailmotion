/**
 * Runs before `next dev` / `next build`:
 *  1. copies the bundled fonts into public/fonts (the in-browser renderer fetches them)
 *  2. renders the six Custom Style designs with the real renderer + serializer into public/gallery
 *     and src/generated/gallery.json, so the landing page shows exactly what the product outputs.
 *  3. renders the ten Simple Style (Signet) designs into public/gallery and
 *     src/generated/signet-gallery.json, the same way.
 */
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFromPreset, PRESET_LIST } from '@mailmotion/presets';
import { createNodeEnv } from '@mailmotion/renderer/node';
import { renderSignatureAssets, toSignatureAssets, uniqueFiles } from '@mailmotion/renderer';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { createConfig, type SignatureConfigInput } from '@mailmotion/schema';
import { serializeSignature } from '@mailmotion/serializer';
import {
  DESIGNS,
  DEFAULT_ACCENT,
  exportHtml,
  renderGif,
  type SignetData,
} from '@mailmotion/signet';

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

// Simple Style: the ten Signet designs, with the same sample details the builder starts from.
GlobalFonts.registerFromPath(join(fontsOut, 'Caveat.ttf'), 'Caveat');
const SIGNET_DETAILS: SignetData = {
  name: 'Shatthiya Ganes',
  title: 'Mobile Security Engineer',
  company: 'Google Inc.',
  phone: '+60 1163348685',
  email: 'satiyaganes.sg@gmail.com',
  website: 'www.satiyaganes.site',
  tagline: 'Full-stack security & mobile engineering',
  status: 'Open to opportunities',
};

const signetGallery: Record<
  string,
  { name: string; use: string; html: string; w: number; h: number }
> = {};

for (const design of DESIGNS) {
  const gif = renderGif(
    design.id,
    SIGNET_DETAILS,
    DEFAULT_ACCENT,
    (w, h) => createCanvas(w, h) as never,
  );
  const file = `signet-${design.id}.gif`;
  writeFileSync(join(galleryOut, file), gif.bytes);
  signetGallery[design.id] = {
    name: design.name,
    use: design.use,
    html: exportHtml(design, SIGNET_DETAILS, DEFAULT_ACCENT, `/gallery/${file}`),
    w: design.w,
    h: design.h,
  };
  console.log(`gallery: ${design.name} (Simple Style) ${gif.bytes.length} bytes`);
}

writeFileSync(join(genOut, 'signet-gallery.json'), JSON.stringify(signetGallery));

// App icons (public/icon.svg, public/brand-mark.png, public/icons/*.png) are committed brand
// assets, not generated here.
console.log(`prepare-assets: ${written.size} gallery files, fonts copied`);
