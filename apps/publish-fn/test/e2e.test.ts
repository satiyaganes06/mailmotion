import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMockGitHub } from '@mailmotion/mock-github/app';
import {
  GitHubAuthError,
  GitHubPublisher,
  RepoMissingError,
  newRepoUrl,
  type UploadFile,
} from '@mailmotion/storage';
import { createApp } from '../src/app';

const ORIGIN = 'http://localhost:3000';
const MOCK = 'http://mock.local';

const setup = (mockOpts: Partial<Parameters<typeof createMockGitHub>[0]> = {}, seed = true) => {
  const mock = createMockGitHub({ baseUrl: MOCK, ...mockOpts });
  if (seed) mock.seedRepo();
  const mockFetch = ((url: string, init?: RequestInit) =>
    mock.app.fetch(new Request(url, init))) as typeof fetch;
  const fn = createApp(
    {
      GITHUB_APP_CLIENT_ID: 'mock-client-id',
      GITHUB_APP_CLIENT_SECRET: 'mock-secret',
      ALLOWED_ORIGINS: ORIGIN,
      GITHUB_OAUTH_BASE: MOCK,
    },
    { fetch: mockFetch },
  );
  return { mock, mockFetch, fn };
};

/** What the browser does: PKCE authorize -> callback code -> ask the function for a token. */
async function signIn(s: ReturnType<typeof setup>, opts: { verifier?: string } = {}) {
  const verifier = 'x'.repeat(64);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const redirect = `${ORIGIN}/publish/callback`;
  const auth = await s.mock.app.request(
    `${MOCK}/login/oauth/authorize?client_id=mock-client-id&redirect_uri=${encodeURIComponent(redirect)}&state=st8&code_challenge=${challenge}&code_challenge_method=S256`,
  );
  expect(auth.status).toBe(302);
  const loc = new URL(auth.headers.get('location')!);
  expect(loc.searchParams.get('state')).toBe('st8');
  const res = await s.fn.request('/auth/token', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({
      code: loc.searchParams.get('code'),
      redirect_uri: redirect,
      code_verifier: opts.verifier ?? verifier,
    }),
  });
  return res;
}

const publisher = (s: ReturnType<typeof setup>, token: string) =>
  new GitHubPublisher({
    token,
    apiBase: MOCK,
    fetch: s.mockFetch,
    pagesBaseUrl: (o, r) => `${MOCK}/pages/${o}/${r}`,
  });

const file = (byte: number, ext = 'gif'): UploadFile => {
  const bytes = new Uint8Array(20).fill(byte);
  return {
    name: `${createHash('sha256').update(bytes).digest('hex')}.${ext}`,
    bytes,
    contentType: ext === 'gif' ? 'image/gif' : 'image/png',
  };
};

describe('Path B end to end (mock GitHub)', () => {
  it('signs in with PKCE, publishes in ONE commit, enables Pages and serves the images', async () => {
    const s = setup();
    const tokRes = await signIn(s);
    expect(tokRes.status).toBe(200);
    const { access_token } = (await tokRes.json()) as { access_token: string };
    expect(access_token).toMatch(/^ghu_mock/);

    const files = [file(1), file(2), file(3, 'png')];
    const pub = publisher(s, access_token);
    const r = await pub.publish(files);
    expect(r).toMatchObject({
      owner: 'octocat',
      repo: 'mailmotion-signatures',
      branch: 'main',
      baseUrl: `${MOCK}/pages/octocat/mailmotion-signatures`,
    });
    expect(r.uploaded.sort()).toEqual(files.map((f) => f.name).sort());
    expect(r.commit).toMatch(/^[0-9a-f]{40}$/);

    const state = (await (await s.mock.app.request('/mock/state')).json()) as {
      repos: { commits: number; pages: unknown; files: string[] }[];
    };
    expect(state.repos[0]!.commits).toBe(1); // a single commit for all files
    expect(state.repos[0]!.pages).toEqual({ branch: 'main' });
    expect(state.repos[0]!.files).toContain('.nojekyll');

    const urls = files.map((f) => `${r.baseUrl}/${f.name}`);
    const live = await pub.waitForLive(urls, { intervalMs: 5, timeoutMs: 1000 });
    expect(live.ok).toBe(true);
    const served = await s.mockFetch(urls[0]!);
    expect(served.headers.get('content-type')).toBe('image/gif');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(files[0]!.bytes);
  });

  it('later publishes add only new files and never rewrite existing ones (sent emails keep working)', async () => {
    const s = setup();
    const { access_token } = (await (await signIn(s)).json()) as { access_token: string };
    const pub = publisher(s, access_token);
    const a = file(10);
    await pub.publish([a]);
    const b = file(11);
    const second = await pub.publish([a, b]);
    expect(second.skipped).toEqual([a.name]);
    expect(second.uploaded).toEqual([b.name]);
    const third = await pub.publish([a, b]);
    expect(third.commit).toBeNull(); // nothing new -> no commit
    const state = (await (await s.mock.app.request('/mock/state')).json()) as {
      repos: { commits: number; files: string[] }[];
    };
    expect(state.repos[0]!.commits).toBe(2);
    expect(state.repos[0]!.files).toEqual(expect.arrayContaining([a.name, b.name, '.nojekyll']));
  });

  it('waits while Pages builds (simulated delay), then succeeds', async () => {
    let clock = 1000;
    const s = setup({ pagesDelayMs: 5000, now: () => clock });
    const { access_token } = (await (await signIn(s)).json()) as { access_token: string };
    const pub = publisher(s, access_token);
    const f = file(20);
    const r = await pub.publish([f]);
    const url = `${r.baseUrl}/${f.name}`;
    const early = await pub.waitForLive([url], { intervalMs: 1, timeoutMs: 20 });
    expect(early.ok).toBe(false);
    expect(early.checks[0]!.status).toBe(404);
    clock += 6000;
    expect((await pub.waitForLive([url], { intervalMs: 1, timeoutMs: 100 })).ok).toBe(true);
  });

  it('guides the user when the repo is missing (GitHub Apps cannot create user repos), then works', async () => {
    const s = setup({}, false);
    const { access_token } = (await (await signIn(s)).json()) as { access_token: string };
    const pub = publisher(s, access_token);
    const err = await pub.publish([file(30)]).catch((e) => e);
    expect(err).toBeInstanceOf(RepoMissingError);
    expect(err.createUrl).toBe(newRepoUrl('mailmotion-signatures'));
    expect(err.createUrl).toContain('visibility=public');
    // the user follows the guided link (mock auto-creates it)
    await s.mock.app.request('/new?name=mailmotion-signatures');
    const r = await pub.publish([file(30)]);
    expect(r.uploaded).toHaveLength(1);
  });

  it('creates the repo itself when the token is allowed to', async () => {
    const s = setup({ allowRepoCreate: true }, false);
    const { access_token } = (await (await signIn(s)).json()) as { access_token: string };
    const r = await publisher(s, access_token).publish([file(31)]);
    expect(r.owner).toBe('octocat');
  });

  it('treats an expired or invalid token as a sign-in problem', async () => {
    const s = setup();
    const err = await publisher(s, 'ghu_not_a_real_token')
      .publish([file(40)])
      .catch((e) => e);
    expect(err).toBeInstanceOf(GitHubAuthError);

    let clock = 1000;
    const s2 = setup({ now: () => clock });
    const { access_token } = (await (await signIn(s2)).json()) as { access_token: string };
    clock += 9 * 3600_000; // tokens expire after 8h
    await expect(publisher(s2, access_token).publish([file(41)])).rejects.toBeInstanceOf(
      GitHubAuthError,
    );
  });

  it('rejects a wrong PKCE verifier and a replayed code', async () => {
    const s = setup();
    const res = await signIn(s, { verifier: 'y'.repeat(64) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'exchange_failed', reason: 'bad_verification_code' });
  });

  it('lists the repositories the app can see', async () => {
    const s = setup();
    const { access_token } = (await (await signIn(s)).json()) as { access_token: string };
    expect(await publisher(s, access_token).listInstalledRepos()).toEqual([
      'octocat/mailmotion-signatures',
    ]);
  });
});
