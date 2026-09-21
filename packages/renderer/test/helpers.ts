import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { createFromPreset } from '@mailmotion/presets';
import {
  createConfig,
  type PresetId,
  type SignatureConfig,
  type SignatureConfigInput,
} from '@mailmotion/schema';
import { inspectGif } from '../src';
import { createNodeEnv } from '../src/node';

export const env = createNodeEnv();

export const DETAILS: SignatureConfigInput['details'] = {
  fullName: 'Shatthiya Ganes',
  title: 'Mobile Security Engineer',
  company: 'Vigilant Asia',
  email: 'ganes@vigilantasia.com',
};

export const SOCIALS: SignatureConfigInput['socials'] = {
  items: [
    { platform: 'website', url: 'https://shatthiyaganes.com' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/shatthiya-ganes' },
    { platform: 'github', url: 'https://github.com/shatthiyaganes' },
    { platform: 'x', url: 'https://x.com/shatthiyaganes' },
    { platform: 'instagram', url: 'https://instagram.com/shatthiyaganes' },
    { platform: 'whatsapp', url: 'https://wa.me/60123456789' },
  ],
};

export function sample(id: PresetId, patch: Partial<SignatureConfigInput> = {}): SignatureConfig {
  const base = createFromPreset(id, DETAILS);
  return createConfig({ ...base, socials: SOCIALS, ...patch } as SignatureConfigInput);
}

/** A 2x2 photo-like test image: gradient + shapes, as a PNG data URL. */
export function testPhotoDataUrl(size = 240): string {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#2d6a8f');
  g.addColorStop(1, '#f2c14e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#f5d0b0';
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.42, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f3a5f';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.95, size * 0.36, size * 0.3, 0, Math.PI, 0);
  ctx.fill();
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

/** Write a contact sheet of up to `max` GIF frames (on a checkerboard) for manual inspection. */
export function dumpContactSheet(name: string, bytes: Uint8Array, max = 12): string | null {
  const dir = process.env.MM_DUMP;
  if (!dir) return null;
  mkdirSync(dir, { recursive: true });
  const info = inspectGif(bytes);
  const n = Math.min(info.frames, max);
  const cols = Math.min(n, 6);
  const rows = Math.ceil(n / cols);
  const cell = 8;
  const sheet = createCanvas(cols * (info.width + cell), rows * (info.height + cell));
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#e8e8ee';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor((i * info.frames) / n);
    const px = info.frame(idx);
    const fc = createCanvas(info.width, info.height);
    const fctx = fc.getContext('2d');
    const id = fctx.createImageData(info.width, info.height);
    id.data.set(px);
    fctx.putImageData(id, 0, 0);
    const x = (i % cols) * (info.width + cell) + cell / 2;
    const y = Math.floor(i / cols) * (info.height + cell) + cell / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, info.width, info.height);
    ctx.drawImage(fc, x, y);
  }
  const file = join(dir, `${name}.png`);
  writeFileSync(file, sheet.toBuffer('image/png'));
  return file;
}

export function writeAsset(name: string, bytes: Uint8Array): void {
  const dir = process.env.MM_DUMP;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), bytes);
}
