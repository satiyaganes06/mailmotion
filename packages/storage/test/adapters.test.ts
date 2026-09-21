import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FILE_NAME, createHttpAdapter, sha256Hex, verifyPublicUrls } from '../src';
import { createAdapterFromEnv, createDiskAdapter, createS3Adapter } from '../src/node';

const bytes = new Uint8Array([1, 2, 3, 4, 5]);
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mm-storage-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const NAME = `${'a'.repeat(64)}.gif`;

describe('FILE_NAME / sha256Hex', () => {
  it('only allows content-hash names', () => {
    expect(FILE_NAME.test(NAME)).toBe(true);
    for (const bad of [
      '../etc/passwd',
      `${'a'.repeat(64)}.svg`,
      `${'A'.repeat(64)}.gif`,
      'x.gif',
      `${'a'.repeat(63)}.gif`,
      `${NAME}/x`,
      `..${NAME}`,
    ]) {
      expect(FILE_NAME.test(bad), bad).toBe(false);
    }
  });
  it('hashes like sha256', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('disk adapter', () => {
  it('stores files atomically, never overwrites, and reports the public URL', async () => {
    const a = createDiskAdapter({ dir, publicBaseUrl: 'https://img.example.com/' });
    const r = await a.put({ name: NAME, bytes, contentType: 'image/gif' });
    expect(r).toEqual({ name: NAME, url: `https://img.example.com/${NAME}`, bytes: 5 });
    expect(await a.exists(NAME)).toBe(true);
    expect((await a.read(NAME))!.equals(Buffer.from(bytes))).toBe(true);
    await a.put({ name: NAME, bytes: new Uint8Array([9, 9]), contentType: 'image/gif' });
    expect((await a.read(NAME))!.equals(Buffer.from(bytes))).toBe(true); // first write wins
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
  it('rejects path traversal and odd names', async () => {
    const a = createDiskAdapter({ dir, publicBaseUrl: 'https://x.example' });
    await expect(a.put({ name: '../evil.gif', bytes, contentType: 'image/gif' })).rejects.toThrow(
      /Invalid/,
    );
    expect(await a.exists('../../etc/passwd')).toBe(false);
    expect(await a.read('../../etc/passwd')).toBeNull();
  });
});

describe('S3 adapter (R2 / MinIO / S3)', () => {
  it('puts with content type and immutable cache headers, checks existence', async () => {
    const s3 = mockClient(S3Client);
    s3.on(PutObjectCommand).resolves({});
    s3.on(HeadObjectCommand, { Key: NAME }).resolves({});
    s3.on(HeadObjectCommand, { Key: `${'b'.repeat(64)}.png` }).rejects(
      Object.assign(new Error('nf'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }),
    );
    const client = new S3Client({ region: 'auto' });
    const a = createS3Adapter({
      bucket: 'mm',
      accessKeyId: 'k',
      secretAccessKey: 's',
      publicBaseUrl: 'https://img.example.com',
      client,
    });
    const r = await a.put({ name: NAME, bytes, contentType: 'image/gif' });
    expect(r.url).toBe(`https://img.example.com/${NAME}`);
    const call = s3.commandCalls(PutObjectCommand)[0]!.args[0].input;
    expect(call).toMatchObject({
      Bucket: 'mm',
      Key: NAME,
      ContentType: 'image/gif',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(await a.exists(NAME)).toBe(true);
    expect(await a.exists(`${'b'.repeat(64)}.png`)).toBe(false);
    await expect(a.put({ name: '../x.gif', bytes, contentType: 'image/gif' })).rejects.toThrow(
      /Invalid/,
    );
  });
});

describe('createAdapterFromEnv', () => {
  it('builds disk by default and validates required settings', () => {
    expect(
      createAdapterFromEnv({ MM_PUBLIC_BASE_URL: 'https://x.example', MM_DATA_DIR: dir }).kind,
    ).toBe('disk');
    expect(() => createAdapterFromEnv({})).toThrow(/MM_PUBLIC_BASE_URL/);
    expect(() =>
      createAdapterFromEnv({ MM_STORAGE: 'r2', MM_PUBLIC_BASE_URL: 'https://x.example' }),
    ).toThrow(/MM_S3_BUCKET/);
    expect(() =>
      createAdapterFromEnv({
        MM_STORAGE: 'minio',
        MM_PUBLIC_BASE_URL: 'https://x.example',
        MM_S3_BUCKET: 'b',
        MM_S3_ACCESS_KEY_ID: 'k',
        MM_S3_SECRET_ACCESS_KEY: 's',
      }),
    ).toThrow(/MM_S3_ENDPOINT/);
    expect(
      createAdapterFromEnv({
        MM_STORAGE: 'r2',
        MM_PUBLIC_BASE_URL: 'https://x.example',
        MM_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
        MM_S3_BUCKET: 'b',
        MM_S3_ACCESS_KEY_ID: 'k',
        MM_S3_SECRET_ACCESS_KEY: 's',
      }).kind,
    ).toBe('s3');
    expect(() =>
      createAdapterFromEnv({ MM_STORAGE: 'ftp', MM_PUBLIC_BASE_URL: 'https://x.example' }),
    ).toThrow(/Unknown MM_STORAGE/);
  });
});

describe('http adapter', () => {
  it('posts bytes with the bearer token and returns the server response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ name: NAME, url: `http://localhost:8787/${NAME}`, bytes: 5 }),
          { status: 201 },
        ),
    );
    const a = createHttpAdapter({
      endpoint: 'http://localhost:8787/',
      token: 'tok',
      fetch: fetchMock as never,
    });
    const r = await a.put({ name: NAME, bytes, contentType: 'image/gif' });
    expect(r.url).toBe(`http://localhost:8787/${NAME}`);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:8787/upload');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect((init.headers as Record<string, string>)['content-type']).toBe('image/gif');
  });
  it('gives a clear error for a rejected token and for server errors', async () => {
    const a = createHttpAdapter({
      endpoint: 'http://x',
      token: 'bad',
      fetch: (async () => new Response('no', { status: 401 })) as never,
    });
    await expect(a.put({ name: NAME, bytes, contentType: 'image/gif' })).rejects.toThrow(
      /token was rejected/,
    );
    const b = createHttpAdapter({
      endpoint: 'http://x',
      token: 't',
      fetch: (async () => new Response('bad file', { status: 415 })) as never,
    });
    await expect(b.put({ name: NAME, bytes, contentType: 'image/gif' })).rejects.toThrow(
      /415.*bad file/,
    );
  });
});

describe('verifyPublicUrls', () => {
  it('flags 404s and wrong content types', async () => {
    const fetchMock = (async (url: string) => {
      if (url.includes('missing')) return new Response('nf', { status: 404 });
      if (url.includes('html'))
        return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (url.endsWith('.png'))
        return new Response(new Uint8Array(3), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        });
      return new Response(new Uint8Array(3), {
        status: 200,
        headers: { 'content-type': 'image/gif' },
      });
    }) as never;
    const r = await verifyPublicUrls(
      ['https://a/ok.gif', 'https://a/x.png', 'https://a/missing.gif', 'https://a/html.gif'],
      { fetch: fetchMock },
    );
    expect(r.map((x) => x.ok)).toEqual([true, true, false, false]);
    expect(r[2]!.error).toMatch(/404/);
    expect(r[3]!.error).toMatch(/Content-Type/);
  });
  it('reports network errors instead of throwing', async () => {
    const r = await verifyPublicUrls(['https://a/x.gif'], {
      fetch: (async () => {
        throw new Error('boom');
      }) as never,
    });
    expect(r[0]).toMatchObject({ ok: false, error: 'boom' });
  });
});
