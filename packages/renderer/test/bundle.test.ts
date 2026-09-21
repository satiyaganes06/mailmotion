import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { importConfig } from '@mailmotion/schema';
import { PLACEHOLDER_BASE, buildBundle, renderSignatureAssets, uniqueFiles } from '../src';
import { env, sample } from './helpers';

describe('buildBundle (ZIP fallback)', () => {
  it('contains every unique image, the HTML, a portable config and a README', async () => {
    const cfg = sample('aurora');
    const rendered = await renderSignatureAssets(cfg, env);
    const b = buildBundle(cfg, rendered, { baseUrl: 'https://cdn.example.com/sig/' });
    const files = unzipSync(b.zip);
    const names = Object.keys(files);
    for (const f of uniqueFiles(rendered).keys()) expect(names).toContain(`images/${f}`);
    expect(names).toEqual(
      expect.arrayContaining(['signature.html', 'signature.mailmotion.json', 'README.txt']),
    );

    const html = strFromU8(files['signature.html']!);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('https://cdn.example.com/sig/');
    expect(html).not.toContain(PLACEHOLDER_BASE);
    for (const f of b.files) expect(html).toContain(`https://cdn.example.com/sig/${f}`);

    const imported = importConfig(strFromU8(files['signature.mailmotion.json']!));
    expect(imported.ok).toBe(true);
    expect(strFromU8(files['README.txt']!)).toContain('https://cdn.example.com/sig');
  }, 60_000);

  it('image bytes in the zip are exactly what was rendered', async () => {
    const cfg = sample('portrait');
    const rendered = await renderSignatureAssets(cfg, env);
    const files = unzipSync(buildBundle(cfg, rendered).zip);
    for (const [name, r] of uniqueFiles(rendered)) expect(files[`images/${name}`]).toEqual(r.bytes);
  }, 60_000);

  it('uses a clearly-fake placeholder base URL when none is given', async () => {
    const cfg = sample('neon');
    const b = buildBundle(cfg, await renderSignatureAssets(cfg, env));
    expect(b.html).toContain(PLACEHOLDER_BASE);
  }, 60_000);
});
