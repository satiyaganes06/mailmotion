import { describe, expect, it, vi } from 'vitest';
import { createApp, type Env } from '../src/app';

const ORIGIN = 'http://localhost:3000';
const VERIFIER = 'v'.repeat(50);
const env: Env = {
  GITHUB_APP_CLIENT_ID: 'Iv1.abc',
  GITHUB_APP_CLIENT_SECRET: 'super-secret-value',
  ALLOWED_ORIGINS: `${ORIGIN}, https://mailmotion.app`,
};

const good = {
  code: 'abc123XYZ',
  redirect_uri: `${ORIGIN}/publish/callback`,
  code_verifier: VERIFIER,
};
const post = (
  app: ReturnType<typeof createApp>,
  body: unknown,
  headers: Record<string, string> = { origin: ORIGIN },
) =>
  app.request('/auth/token', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });

const githubOk = () =>
  vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          access_token: 'ghu_token123',
          expires_in: 28800,
          token_type: 'bearer',
          scope: '',
          refresh_token: 'ghr_secret',
          internal: 'x',
        }),
        { status: 200 },
      ),
  );

describe('POST /auth/token', () => {
  it('exchanges the code (with PKCE and the client secret) and returns only the token fields', async () => {
    const f = githubOk();
    const app = createApp(env, { fetch: f as never });
    const res = await post(app, good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      access_token: 'ghu_token123',
      expires_in: 28800,
      token_type: 'bearer',
    });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);

    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://github.com/login/oauth/access_token');
    const sent = JSON.parse(String(init!.body));
    expect(sent).toMatchObject({
      client_id: 'Iv1.abc',
      client_secret: 'super-secret-value',
      code: 'abc123XYZ',
      code_verifier: VERIFIER,
      redirect_uri: good.redirect_uri,
    });
  });

  it('never leaks the secret or refresh token back to the browser', async () => {
    const app = createApp(env, { fetch: githubOk() as never });
    const text = await (await post(app, good)).text();
    expect(text).not.toContain('super-secret-value');
    expect(text).not.toContain('ghr_secret');
    expect(text).not.toContain('internal');
  });

  it('does not log tokens or secrets', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const app = createApp(env, { fetch: githubOk() as never });
    await post(app, good);
    await post(app, { ...good, code: '!!' });
    for (const s of spies) {
      const out = JSON.stringify(s.mock.calls);
      expect(out).not.toContain('ghu_token123');
      expect(out).not.toContain('super-secret-value');
      s.mockRestore();
    }
  });

  it('rejects unknown, missing and mismatched origins', async () => {
    const app = createApp(env, { fetch: githubOk() as never });
    expect((await post(app, good, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(app, good, {})).status).toBe(403);
    // allowed origin, but redirect_uri points elsewhere
    expect((await post(app, { ...good, redirect_uri: 'https://evil.example/cb' })).status).toBe(
      400,
    );
    // allowed origin, redirect_uri on a different allowed origin than the caller
    expect((await post(app, { ...good, redirect_uri: 'https://mailmotion.app/cb' })).status).toBe(
      400,
    );
  });

  it('answers CORS preflights only for allowed origins', async () => {
    const app = createApp(env);
    const ok = await app.request('/auth/token', { method: 'OPTIONS', headers: { origin: ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const bad = await app.request('/auth/token', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('validates the request body', async () => {
    const app = createApp(env, { fetch: githubOk() as never });
    expect((await post(app, 'not json')).status).toBe(400);
    expect((await post(app, { ...good, code: '../../x' })).status).toBe(400);
    expect((await post(app, { ...good, code: undefined })).status).toBe(400);
    expect((await post(app, { ...good, code_verifier: 'short' })).status).toBe(400); // PKCE is mandatory
    expect((await post(app, { ...good, code_verifier: undefined })).status).toBe(400);
    expect((await post(app, { ...good, redirect_uri: 'not a url' })).status).toBe(400);
  });

  it('maps GitHub errors without leaking details', async () => {
    const bad = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect',
            client_secret_hint: 'x',
          }),
          { status: 200 },
        ),
    );
    const res = await post(createApp(env, { fetch: bad as never }), good);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'exchange_failed', reason: 'bad_verification_code' });
    const down = await post(
      createApp(env, {
        fetch: (async () => {
          throw new Error('dns');
        }) as never,
      }),
      good,
    );
    expect(down.status).toBe(502);
    const junk = await post(
      createApp(env, { fetch: (async () => new Response('<html>', { status: 200 })) as never }),
      good,
    );
    expect(junk.status).toBe(502);
  });

  it('rate limits per client and recovers after a minute', async () => {
    let t = 0;
    const app = createApp(
      { ...env, RATE_PER_MINUTE: '3' },
      { fetch: githubOk() as never, now: () => t },
    );
    const h = { origin: ORIGIN, 'x-forwarded-for': '1.2.3.4' };
    const codes = [] as number[];
    for (let i = 0; i < 5; i++) codes.push((await post(app, good, h)).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect((await post(app, good, { ...h, 'x-forwarded-for': '5.6.7.8' })).status).toBe(200); // other client unaffected
    t += 61_000;
    expect((await post(app, good, h)).status).toBe(200);
  });

  it('reports a clear 503 when not configured, and healthz says so', async () => {
    const app = createApp({ ALLOWED_ORIGINS: ORIGIN });
    expect((await post(app, good)).status).toBe(503);
    expect(await (await app.request('/healthz')).json()).toEqual({ ok: true, configured: false });
    expect(await (await createApp(env).request('/healthz')).json()).toEqual({
      ok: true,
      configured: true,
    });
  });

  it('uses GITHUB_OAUTH_BASE for local development', async () => {
    const f = githubOk();
    await post(
      createApp({ ...env, GITHUB_OAUTH_BASE: 'http://localhost:8790/' }, { fetch: f as never }),
      good,
    );
    expect(f.mock.calls[0]![0]).toBe('http://localhost:8790/login/oauth/access_token');
  });
});
