import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { inspectGif } from '@mailmotion/renderer';
import { importConfig } from '@mailmotion/schema';
import { lintHtml } from '@mailmotion/serializer';
import { run, type IO } from '../src/run';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mm-cli-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const cli = async (args: string[], env: Record<string, string> = {}) => {
  const out: string[] = [];
  const err: string[] = [];
  const io: IO = { out: (s) => out.push(s), err: (s) => err.push(s), cwd: dir, env };
  const code = await run(args, io);
  return { code, out: out.join('\n'), err: err.join('\n') };
};

describe('mailmotion CLI', () => {
  it('prints help and exits 2 when run with no command', async () => {
    const r = await cli([]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('Usage');
    expect((await cli(['--help'])).code).toBe(0);
  });

  it('lists the six presets', async () => {
    const r = await cli(['presets']);
    expect(r.code).toBe(0);
    for (const id of ['aurora', 'portrait', 'editorial', 'wave', 'neon', 'equalizer'])
      expect(r.out).toContain(id);
  });

  it('init writes a valid portable config and refuses to overwrite', async () => {
    const r = await cli([
      'init',
      '--preset',
      'neon',
      '--name',
      'Grace Hopper',
      '--out',
      'sig.json',
    ]);
    expect(r.code).toBe(0);
    const cfg = importConfig(await readFile(join(dir, 'sig.json'), 'utf8'));
    expect(cfg.ok && cfg.config.details.fullName).toBe('Grace Hopper');
    expect(cfg.ok && cfg.config.layout.id).toBe('bordered');
    expect((await cli(['init', '--out', 'sig.json'])).code).toBe(2);
    expect((await cli(['init', '--preset', 'nope', '--out', 'x.json'])).code).toBe(2);
  });

  it('validate reports OK and exits non-zero for invalid JSON or configs', async () => {
    const ok = await cli(['validate', 'sig.json']);
    expect(ok.code).toBe(0);
    expect(ok.out).toContain('OK: Grace Hopper');
    expect(ok.out).toMatch(/HTML: [\d,]+ \/ 10,000/);
    await writeFile(
      join(dir, 'bad.json'),
      JSON.stringify({ details: { fullName: '', email: 'nope' } }),
    );
    const bad = await cli(['validate', 'bad.json']);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('Invalid config');
    expect((await cli(['validate', 'missing.json'])).code).toBe(2);
    await writeFile(join(dir, 'junk.json'), 'not json');
    expect((await cli(['validate', 'junk.json'])).code).toBe(1);
  });

  it('render writes images, HTML, .htm, .mailsignature and the config; GIFs meet the budgets', async () => {
    const r = await cli([
      'render',
      'sig.json',
      '--out',
      'out1',
      '--base-url',
      'https://cdn.example.com/sig',
      '--check',
    ]);
    expect(r.code, r.err + r.out).toBe(0);
    const files = await readdir(join(dir, 'out1'));
    expect(files).toEqual(
      expect.arrayContaining([
        'grace-hopper.html',
        'grace-hopper.htm',
        'grace-hopper.mailsignature',
        'grace-hopper.mailmotion.json',
        'images',
      ]),
    );
    const html = await readFile(join(dir, 'out1', 'grace-hopper.html'), 'utf8');
    expect(lintHtml(html)).toEqual([]);
    expect(html.length).toBeLessThanOrEqual(10_000);
    const images = await readdir(join(dir, 'out1', 'images'));
    expect(images.length).toBeGreaterThanOrEqual(2);
    for (const name of images) {
      expect(html).toContain(`https://cdn.example.com/sig/${name}`);
      if (name.endsWith('.gif')) {
        const g = inspectGif(new Uint8Array(await readFile(join(dir, 'out1', 'images', name))));
        expect(g.bytes).toBeLessThanOrEqual(300 * 1024);
        expect(g.maxFps).toBeLessThanOrEqual(12);
      }
    }
    expect(r.out).toContain('characters');
  }, 90_000);

  it('render --json emits a machine-readable report, --zip a bundle, --variant reply drops the mark', async () => {
    const full = await cli([
      'render',
      'sig.json',
      '--out',
      'out2',
      '--json',
      '--zip',
      '--base-url',
      'https://cdn.example.com',
    ]);
    expect(full.code).toBe(0);
    const report = JSON.parse(full.out);
    expect(report.problems).toEqual([]);
    expect(report.images.some((i: { kind: string }) => i.kind === 'mark')).toBe(true);
    expect(existsSync(join(dir, 'out2', 'grace-hopper.zip'))).toBe(true);
    const zip = unzipSync(new Uint8Array(await readFile(join(dir, 'out2', 'grace-hopper.zip'))));
    expect(Object.keys(zip)).toEqual(expect.arrayContaining(['signature.html', 'README.txt']));

    const reply = await cli([
      'render',
      'sig.json',
      '--out',
      'out3',
      '--json',
      '--variant',
      'reply',
    ]);
    expect(JSON.parse(reply.out).images.some((i: { kind: string }) => i.kind === 'mark')).toBe(
      false,
    );
    expect((await cli(['render', 'sig.json', '--variant', 'bogus'])).code).toBe(2);
  }, 120_000);

  it('rejects unsafe or missing render arguments', async () => {
    expect((await cli(['render'])).code).toBe(2);
    expect(
      (await cli(['render', 'sig.json', '--base-url', 'http://insecure.example', '--out', 'o4']))
        .code,
    ).toBe(2);
    expect(
      (await cli(['render', 'sig.json', '--upload', 'https://up.example', '--out', 'o5'])).code,
    ).toBe(2); // needs a token
    expect((await cli(['frobnicate'])).code).toBe(2);
  }, 60_000);

  it('validate reports the character budget for a heavy signature', async () => {
    const big = importConfig(await readFile(join(dir, 'sig.json'), 'utf8'));
    if (!big.ok) throw new Error('fixture');
    const cfg = {
      ...big.config,
      extras: { ...big.config.extras, disclaimer: 'x'.repeat(800), greenNote: true },
      socials: {
        ...big.config.socials,
        items: Array.from({ length: 14 }, (_, i) => ({
          platform: 'website' as const,
          url: `https://example.com/${i}`,
        })),
      },
    };
    await writeFile(
      join(dir, 'big.json'),
      JSON.stringify({
        format: 'mailmotion.signature',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        config: cfg,
      }),
    );
    const v = await cli(['validate', 'big.json']);
    expect(v.out).toMatch(/HTML: [\d,]+ \/ 10,000/);
  }, 60_000);
});
