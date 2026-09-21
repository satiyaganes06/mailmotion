import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serializeWithPlaceholders } from '@mailmotion/serializer';
import { createFromPreset } from '@mailmotion/presets';
import { crc32, sanitizeImage, sha256Hex } from '@mailmotion/storage';
import { createDiskAdapter } from '@mailmotion/storage/node';
import { createApp, validateConfig } from '../src/app';

const TOKEN = 'a'.repeat(32);
let dir: string;
let clock = 1_000_000;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mm-server-'));
  const adapter = createDiskAdapter({
    dir: join(dir, 'files'),
    publicBaseUrl: 'https://img.example.com',
  });
  app = createApp(
    {
      uploadToken: TOKEN,
      allowedOrigins: ['https://app.example.com'],
      dataDir: dir,
      ratePerMinute: 1000,
    },
    adapter,
    { now: () => clock },
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const png = () => Buffer.from(createCanvas(8, 8).toBuffer('image/png'));
const auth = { authorization: `Bearer ${TOKEN}` };
const upload = (
  body: Uint8Array | Buffer,
  type = 'image/png',
  headers: Record<string, string> = auth,
) =>
  app.request('/upload', {
    method: 'POST',
    body: body as never,
    headers: { 'content-type': type, ...headers },
  });

describe('config', () => {
  it('refuses weak or example tokens', () => {
    expect(() => validateConfig({ uploadToken: '', allowedOrigins: [], dataDir: '.' })).toThrow(
      /MM_UPLOAD_TOKEN/,
    );
    expect(() =>
      validateConfig({ uploadToken: 'short', allowedOrigins: [], dataDir: '.' }),
    ).toThrow();
    expect(() =>
      validateConfig({ uploadToken: 'change-me', allowedOrigins: [], dataDir: '.' }),
    ).toThrow();
  });
});

describe('upload', () => {
  it('requires the bearer token', async () => {
    expect((await upload(png(), 'image/png', {})).status).toBe(401);
    expect((await upload(png(), 'image/png', { authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await upload(png(), 'image/png', { authorization: TOKEN })).status).toBe(401);
  });

  it('stores a PNG under its sha256 and serves it back with safe headers', async () => {
    const body = png();
    const res = await upload(body);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { name: string; url: string; kind: string };
    // the name is the hash of the *sanitized* file (canvas PNGs carry ancillary chunks that are dropped)
    const clean = sanitizeImage(new Uint8Array(body));
    if (!clean.ok) throw new Error('fixture invalid');
    expect(json.name).toBe(`${await sha256Hex(clean.bytes)}.png`);
    expect(json.url).toBe(`https://img.example.com/${json.name}`);

    const get = await app.request(`/${json.name}`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(get.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(get.headers.get('x-content-type-options')).toBe('nosniff');
    expect(get.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(get.headers.get('access-control-allow-origin')).toBe('*');
    expect(Buffer.from(await get.arrayBuffer()).equals(Buffer.from(clean.bytes))).toBe(true);

    const head = await app.request(`/${json.name}`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('strips metadata before hashing, so the stored name is that of the clean file', async () => {
    const raw = png();
    const sanitized = sanitizeImage(new Uint8Array(raw));
    if (!sanitized.ok) throw new Error('fixture invalid');
    const clean = Buffer.from(sanitized.bytes);
    const iend = clean.length - 12;
    const data = Buffer.from('GPS:3.139N,101.687E');
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    chunk.write('eXIf', 4, 'latin1');
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
    const dirty = Buffer.concat([clean.subarray(0, iend), chunk, clean.subarray(iend)]);
    const res = await upload(dirty);
    expect(res.status).toBe(201);
    const { name } = (await res.json()) as { name: string };
    expect(name).toBe(`${await sha256Hex(new Uint8Array(clean))}.png`);
    const stored = Buffer.from(await (await app.request(`/${name}`)).arrayBuffer());
    expect(stored.toString('latin1')).not.toContain('GPS');
  });

  it('rejects wrong types, mismatched content, HTML and SVG', async () => {
    expect((await upload(png(), 'text/html')).status).toBe(415);
    expect((await upload(png(), 'image/svg+xml')).status).toBe(415);
    expect((await upload(png(), 'image/gif')).status).toBe(422); // PNG bytes declared as GIF
    expect((await upload(Buffer.from('<script>alert(1)</script>'), 'image/png')).status).toBe(422);
    expect(
      (await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png')).status,
    ).toBe(422);
    expect((await upload(Buffer.alloc(0), 'image/png')).status).toBe(422);
  });

  it('enforces the byte cap (declared and actual)', async () => {
    const small = createApp(
      { uploadToken: TOKEN, allowedOrigins: [], dataDir: dir, maxUploadBytes: 100 },
      createDiskAdapter({ dir: join(dir, 'f2'), publicBaseUrl: 'https://x.example' }),
    );
    const r = await small.request('/upload', {
      method: 'POST',
      body: png() as never,
      headers: { ...auth, 'content-type': 'image/png', 'content-length': '5000' },
    });
    expect(r.status).toBe(413);
    const r2 = await small.request('/upload', {
      method: 'POST',
      body: Buffer.alloc(500, 1) as never,
      headers: { ...auth, 'content-type': 'image/png' },
    });
    expect(r2.status).toBe(422);
  });

  it('rate limits per client', async () => {
    const limited = createApp(
      { uploadToken: TOKEN, allowedOrigins: [], dataDir: dir, ratePerMinute: 3 },
      createDiskAdapter({ dir: join(dir, 'f3'), publicBaseUrl: 'https://x.example' }),
      { now: () => clock },
    );
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (
          await limited.request('/upload', {
            method: 'POST',
            body: png() as never,
            headers: { ...auth, 'content-type': 'image/png' },
          })
        ).status,
      );
    }
    expect(statuses).toEqual([201, 201, 201, 429, 429]);
  });
});

describe('serving', () => {
  it('404s unknown files, traversal and directory listings', async () => {
    for (const path of [
      '/',
      '/files',
      `/${'0'.repeat(64)}.gif`,
      '/..%2Fetc%2Fpasswd',
      `/${'a'.repeat(64)}.svg`,
      '/%2e%2e/secret',
    ]) {
      const r = await app.request(path);
      expect(r.status, path).toBe(404);
    }
  });
  it('healthz reports the adapter', async () => {
    const r = await app.request('/healthz');
    expect(await r.json()).toEqual({ ok: true, storage: 'disk' });
  });
});

describe('CORS', () => {
  it('allows the configured origin only for the API, and preflights', async () => {
    const pre = await app.request('/upload', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example.com' },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
    const evil = await app.request('/upload', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('send to my phone (shares)', () => {
  const html = () =>
    serializeWithPlaceholders(createFromPreset('aurora', { fullName: 'Ada Lovelace' })).html;
  const post = (body: unknown, headers: Record<string, string> = auth) =>
    app.request('/share', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...headers },
    });

  it('creates an unguessable token, serves it publicly (noindex), and expires after 24h', async () => {
    const res = await post({ html: html() });
    expect(res.status).toBe(201);
    const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(expiresAt).toBe(clock + 24 * 3600 * 1000);

    const got = await app.request(`/share/${token}`);
    expect(got.status).toBe(200);
    expect(got.headers.get('x-robots-tag')).toContain('noindex');
    expect(got.headers.get('cache-control')).toBe('no-store');
    expect(((await got.json()) as { html: string }).html).toContain('Ada Lovelace');

    clock += 24 * 3600 * 1000 + 1;
    expect((await app.request(`/share/${token}`)).status).toBe(410);
    expect((await app.request(`/share/${token}`)).status).toBe(404); // deleted after expiry
  });

  it('requires auth and rejects unsafe or oversized HTML', async () => {
    expect((await post({ html: html() }, {})).status).toBe(401);
    expect(
      (await post({ html: '<table><tr><td><script>alert(1)</script></td></tr></table>' })).status,
    ).toBe(422);
    expect((await post({ html: '<a href="javascript:alert(1)">x</a>' })).status).toBe(422);
    expect((await post({ html: 'x'.repeat(70_000) })).status).toBe(400);
    expect((await post({ nope: 1 })).status).toBe(400);
    expect(
      (await app.request('/share', { method: 'POST', body: 'not json', headers: auth })).status,
    ).toBe(400);
  });

  it('never reveals other files through the token route', async () => {
    for (const t of ['../files/x', '0'.repeat(31), 'z'.repeat(32), '0'.repeat(32)]) {
      expect((await app.request(`/share/${encodeURIComponent(t)}`)).status).toBe(404);
    }
  });
});
