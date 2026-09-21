// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGitHub } from '@mailmotion/mock-github/app';
import { createApp as createFn } from '@mailmotion/publish-fn/app';
import type { RenderedAsset } from '@mailmotion/renderer';
import {
  buildAuthorizeUrl,
  challengeFor,
  clearToken,
  completeSignIn,
  getToken,
  makePublisher,
  publishToGitHub,
  randomString,
  rememberPending,
  setToken,
  toUploadFiles,
} from '../src/lib/github-flow';

const ORIGIN = 'http://localhost:3100';

const setup = (
  opts: Parameters<typeof createMockGitHub>[0] extends infer T ? Partial<T> : never = {},
) => {
  const mock = createMockGitHub({ baseUrl: 'http://mock.local', ...opts });
  mock.seedRepo();
  const mockFetch = ((u: string, i?: RequestInit) =>
    mock.app.fetch(new Request(u, i))) as typeof fetch;
  const fn = createFn(
    {
      GITHUB_APP_CLIENT_ID: 'mock-client-id',
      GITHUB_APP_CLIENT_SECRET: 'mock-secret',
      ALLOWED_ORIGINS: ORIGIN,
      GITHUB_OAUTH_BASE: 'http://mock.local',
    },
    { fetch: mockFetch },
  );
  // the browser talks to the function and to GitHub through this router
  const browserFetch = ((u: string, i?: RequestInit) => {
    const url = new URL(u);
    if (url.origin === 'http://fn.local')
      return fn.fetch(
        new Request(u.replace('http://fn.local', 'http://x'), {
          ...i,
          headers: { ...(i?.headers as object), origin: ORIGIN },
        }),
      );
    return mockFetch(u, i);
  }) as typeof fetch;
  return { mock, mockFetch, browserFetch };
};

async function authorize(mock: ReturnType<typeof setup>['mock']) {
  const { url, pending } = await buildAuthorizeUrl(ORIGIN);
  rememberPending(pending);
  const res = await mock.app.request(url);
  expect(res.status).toBe(302);
  return { pending, location: new URL(res.headers.get('location')!) };
}

const asset = (n: number): RenderedAsset =>
  ({
    slotId: `s${n}`,
    kind: 'avatar',
    format: 'gif',
    bytes: new Uint8Array(24).fill(n),
    hash: n.toString(16).padStart(64, '0'),
    fileName: `${n.toString(16).padStart(64, '0')}.gif`,
    width: 8,
    height: 8,
    frames: 1,
    scale: 2,
    degraded: [],
    fitsBudget: true,
    delaysMs: [],
  }) as RenderedAsset;

beforeEach(() => {
  clearToken();
  sessionStorage.clear();
});

describe('PKCE helpers', () => {
  it('matches the RFC 7636 test vector', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
  it('generates url-safe randoms of the right size', () => {
    const v = randomString(48);
    expect(v).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(randomString(48)).not.toBe(v);
  });
  it('builds an authorize URL with state, S256 challenge and the callback redirect', async () => {
    const { url, pending } = await buildAuthorizeUrl(ORIGIN);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('http://mock.local/login/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('mock-client-id');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe(pending.state);
    expect(u.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/publish/callback/`);
    expect(u.searchParams.get('code_challenge')).toBe(await challengeFor(pending.verifier));
    expect(url).not.toContain(pending.verifier); // the verifier never leaves the browser until the exchange
  });
});

describe('in-memory token', () => {
  it('expires, clears, and is never written to any web storage', () => {
    setToken('ghu_secret_token', 100, 1_000);
    expect(getToken(50_000)).toBe('ghu_secret_token');
    expect(getToken(1_000 + 100_000)).toBeNull();
    setToken('ghu_secret_token', 3600);
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++)
        expect(store.getItem(store.key(i)!)).not.toContain('ghu_secret_token');
    }
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('completeSignIn', () => {
  it('verifies state, exchanges the code through the function and stores the token in memory', async () => {
    const s = setup();
    const { location } = await authorize(s.mock);
    const r = await completeSignIn(location.search, s.browserFetch);
    expect(r).toEqual({ ok: true });
    expect(getToken()).toMatch(/^ghu_mock/);
    expect(sessionStorage.getItem('mm:oauth:pending')).toBeNull(); // single use
  });

  it('rejects a state mismatch (CSRF) and a missing pending record', async () => {
    const s = setup();
    const { location } = await authorize(s.mock);
    const params = new URLSearchParams(location.search);
    params.set('state', 'forged');
    const bad = await completeSignIn(`?${params}`, s.browserFetch);
    expect(bad.ok).toBe(false);
    expect(getToken()).toBeNull();
    const none = await completeSignIn(location.search, s.browserFetch);
    expect(none.ok).toBe(false);
  });

  it('reports user cancellation, incomplete responses and service failures', async () => {
    const s = setup();
    expect(
      await completeSignIn('?error=access_denied&error_description=You+cancelled', s.browserFetch),
    ).toEqual({ ok: false, message: 'You cancelled' });
    expect((await completeSignIn('', s.browserFetch)).ok).toBe(false);
    const { location } = await authorize(s.mock);
    const down = (async () => {
      throw new Error('offline');
    }) as never;
    const r = await completeSignIn(location.search, down);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/reach the sign-in service/);
  });

  it('a replayed code is refused', async () => {
    const s = setup();
    const { pending, location } = await authorize(s.mock);
    await completeSignIn(location.search, s.browserFetch);
    clearToken();
    rememberPending(pending);
    const again = await completeSignIn(location.search, s.browserFetch);
    expect(again.ok).toBe(false);
    expect(getToken()).toBeNull();
  });
});

describe('publishToGitHub (against the mock)', () => {
  it('commits, enables Pages, waits until images load and returns hosted URLs', async () => {
    const s = setup();
    const { location } = await authorize(s.mock);
    await completeSignIn(location.search, s.browserFetch);
    const rendered = [asset(1), asset(2), asset(1)]; // duplicate file is uploaded once
    const steps: string[] = [];
    const publisher = makePublisher(getToken()!, s.mockFetch);
    const r = await publishToGitHub(rendered, (st) => steps.push(st), publisher);
    expect(toUploadFiles(rendered)).toHaveLength(2);
    expect(r).toMatchObject({
      owner: 'octocat',
      repo: 'mailmotion-signatures',
      uploaded: 2,
      skipped: 0,
    });
    expect(Object.keys(r.fileUrls)).toHaveLength(2);
    for (const url of Object.values(r.fileUrls))
      expect(url).toMatch(
        /^http:\/\/mock\.local\/pages\/octocat\/mailmotion-signatures\/[0-9a-f]{64}\.gif$/,
      );
    expect(steps).toEqual(expect.arrayContaining(['committing', 'pages', 'waiting', 'done']));
    const again = await publishToGitHub(rendered, () => {}, publisher);
    expect(again).toMatchObject({ uploaded: 0, skipped: 2 });
  });

  it('asks the user to connect when there is no token', async () => {
    await expect(publishToGitHub([asset(3)], () => {})).rejects.toThrow(/Connect GitHub/);
  });

  it('explains when Pages has not finished building', async () => {
    let clock = 1000;
    const s = setup({ pagesDelayMs: 60_000, now: () => clock });
    const { location } = await authorize(s.mock);
    await completeSignIn(location.search, s.browserFetch);
    const publisher = makePublisher(getToken()!, s.mockFetch);
    vi.spyOn(publisher, 'waitForLive').mockResolvedValue({
      ok: false,
      checks: [{ url: 'x', ok: false, status: 404 }],
    });
    await expect(publishToGitHub([asset(4)], () => {}, publisher)).rejects.toThrow(
      /still building/,
    );
  });
});
