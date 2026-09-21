import { describe, expect, it, vi } from 'vitest';
import type { RenderedAsset } from '@mailmotion/renderer';
import {
  assetsFromHosted,
  hostedFromBaseUrl,
  missingFiles,
  publishToServer,
  type Hosted,
} from '../src/lib/hosting';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const asset = (slotId: string, hash: string): RenderedAsset =>
  ({
    slotId,
    kind: 'avatar',
    format: 'gif',
    bytes: new Uint8Array([1, 2, 3]),
    hash,
    fileName: `${hash}.gif`,
    width: 10,
    height: 10,
    frames: 1,
    scale: 2,
    degraded: [],
    fitsBudget: true,
    delaysMs: [],
  }) as RenderedAsset;
const rendered = [asset('avatar', A), asset('mark', B)];

describe('assetsFromHosted', () => {
  it('maps every slot to its hosted URL', () => {
    const h: Hosted = {
      via: 'github',
      at: 1,
      fileUrls: { [`${A}.gif`]: `https://x.io/${A}.gif`, [`${B}.gif`]: `https://x.io/${B}.gif` },
    };
    expect(assetsFromHosted(rendered, h)!.slots.mark).toEqual({
      url: `https://x.io/${B}.gif`,
      width: 10,
      height: 10,
    });
  });
  it('returns null when anything is unhosted, so stale HTML is never offered', () => {
    const h: Hosted = { via: 'github', at: 1, fileUrls: { [`${A}.gif`]: `https://x.io/${A}.gif` } };
    expect(assetsFromHosted(rendered, h)).toBeNull();
    expect(missingFiles(rendered, h)).toEqual([`${B}.gif`]);
    expect(assetsFromHosted(rendered, null)).toBeNull();
    expect(assetsFromHosted([], h)).toBeNull();
  });
});

describe('hostedFromBaseUrl (manual/ZIP path)', () => {
  it('builds URLs under an https base and trims trailing slashes', () => {
    const r = hostedFromBaseUrl(rendered, 'https://example.com/sig///');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hosted.fileUrls[`${A}.gif`]).toBe(`https://example.com/sig/${A}.gif`);
  });
  it('rejects non-https and junk', () => {
    for (const bad of [
      'http://example.com',
      'javascript:alert(1)',
      'not a url',
      '',
      'https://user:pw@example.com',
    ]) {
      expect(hostedFromBaseUrl(rendered, bad).ok, bad).toBe(false);
    }
  });
});

describe('publishToServer (Path A)', () => {
  it('uploads each unique file with the token and records the URLs the server returns', async () => {
    const calls: { url: string; auth: string }[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init!.headers as Record<string, string>).authorization! });
      return new Response(
        JSON.stringify({ name: 'n', url: `https://img.example.com/${calls.length}.gif`, bytes: 3 }),
        { status: 201 },
      );
    });
    const progress: number[] = [];
    const h = await publishToServer(
      [...rendered, asset('avatar2', A)],
      { endpoint: 'https://up.example.com', token: ' secret ' },
      (d) => progress.push(d),
      f as never,
    );
    expect(f).toHaveBeenCalledTimes(2); // A is a duplicate
    expect(
      calls.every((c) => c.auth === 'Bearer secret' && c.url === 'https://up.example.com/upload'),
    ).toBe(true);
    expect(h.via).toBe('server');
    expect(Object.values(h.fileUrls)).toEqual([
      'https://img.example.com/1.gif',
      'https://img.example.com/2.gif',
    ]);
    expect(progress).toEqual([1, 2]);
  });
  it('validates the endpoint and surfaces a rejected token', async () => {
    await expect(publishToServer(rendered, { endpoint: 'ftp://x', token: 't' })).rejects.toThrow(
      /address of your storage server/,
    );
    await expect(
      publishToServer(
        rendered,
        { endpoint: 'https://x.example', token: 'bad' },
        undefined,
        (async () => new Response('no', { status: 401 })) as never,
      ),
    ).rejects.toThrow(/token was rejected/);
  });
});
