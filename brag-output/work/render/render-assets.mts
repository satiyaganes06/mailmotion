// Mirrors apps/web/scripts/prepare-assets.ts, but with the brag video's details.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFromPreset, PRESET_LIST } from '@mailmotion/presets';
import { createNodeEnv } from '@mailmotion/renderer/node';
import { renderSignatureAssets, toSignatureAssets, uniqueFiles } from '@mailmotion/renderer';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { createConfig, type SignatureConfigInput } from '@mailmotion/schema';
import { serializeSignature } from '@mailmotion/serializer';
import { DESIGNS, DEFAULT_ACCENT, exportHtml, renderGif, type SignetData } from '@mailmotion/signet';

const here = dirname(fileURLToPath(import.meta.url));
const repo = '/Users/sivajipro/Developer/Apps/MailMotion';
const fontsSrc = join(repo, 'packages', 'ink', 'fonts');
const out = join(here, '..', 'assets');
mkdirSync(join(out, 'img'), { recursive: true });

const env = createNodeEnv({ fontsDir: fontsSrc });
const PLACEHOLDER = 'https://assets.invalid';

const DETAILS: SignatureConfigInput['details'] = {
  fullName: 'Satiya Ganes',
  title: 'Founder',
  company: 'MailMotion',
  companyUrl: 'https://github.com/satiyaganes06/mailmotion',
  phones: [],
  email: 'satiyaganes.sg@example.com',
  websites: [{ url: 'https://github.com/satiyaganes06/mailmotion' }],
};
const SOCIALS: SignatureConfigInput['socials'] = {
  items: [
    { platform: 'website', url: 'https://github.com/satiyaganes06/mailmotion' },
    { platform: 'github', url: 'https://github.com/satiyaganes06' },
  ],
};

const custom: Record<string, unknown> = {};
for (const preset of PRESET_LIST) {
  const base = createFromPreset(preset.id, DETAILS);
  const cfg = createConfig({ ...base, socials: SOCIALS } as SignatureConfigInput);
  const rendered = await renderSignatureAssets(cfg, env);
  for (const [name, r] of uniqueFiles(rendered)) writeFileSync(join(out, 'img', name), r.bytes);
  const { html, chars, issues } = serializeSignature(cfg, toSignatureAssets(rendered, PLACEHOLDER));
  if (issues.length) throw new Error(`${preset.id}: ${JSON.stringify(issues)}`);
  custom[preset.id] = {
    name: preset.name,
    bestFor: preset.bestFor,
    layout: preset.layout,
    avatarAnimation: preset.avatarAnimation,
    html: html.replaceAll(`${PLACEHOLDER}/`, 'assets/img/'),
    chars,
    controls: {
      layout: cfg.layout.id,
      avatar: (cfg as any).avatar?.animation,
      mark: (cfg as any).mark?.animation,
      palette: (cfg as any).theme?.palette,
    },
    gifs: (rendered as any[])
      .filter((r) => r.format === 'gif')
      .map((r) => ({ kind: r.kind, fileName: r.fileName, frames: r.frames, bytes: r.bytes.length })),
  };
  console.log(`custom ${preset.name}: ${chars} chars`);
}
writeFileSync(join(out, 'custom.json'), JSON.stringify(custom, null, 1));

GlobalFonts.registerFromPath(join(repo, 'apps/web/public/fonts/Caveat.ttf'), 'Caveat');
const SIGNET: SignetData = {
  name: 'Satiya Ganes',
  title: 'Founder',
  company: 'MailMotion',
  phone: '',
  email: 'satiyaganes.sg@example.com',
  website: 'github.com/satiyaganes06/mailmotion',
  tagline: 'Animated signatures that actually render',
  status: 'Shipping MailMotion v1',
};
const signet: Record<string, unknown> = {};
for (const design of DESIGNS) {
  const gif = renderGif(design.id, SIGNET, DEFAULT_ACCENT, (w, h) => createCanvas(w, h) as never);
  const file = `signet-${design.id}.gif`;
  writeFileSync(join(out, 'img', file), gif.bytes);
  signet[design.id] = {
    name: design.name,
    use: design.use,
    html: exportHtml(design, SIGNET, DEFAULT_ACCENT, `assets/img/${file}`),
    w: design.w,
    h: design.h,
    bytes: gif.bytes.length,
  };
  console.log(`signet ${design.name}: ${gif.bytes.length} bytes`);
}
writeFileSync(join(out, 'signet.json'), JSON.stringify(signet, null, 1));
