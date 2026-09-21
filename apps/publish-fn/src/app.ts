import { Hono } from 'hono';

export interface Env {
  GITHUB_APP_CLIENT_ID?: string;
  /** Secret. Never sent to the browser, never logged. */
  GITHUB_APP_CLIENT_SECRET?: string;
  /** Comma-separated origins allowed to call this function (the builder's origin). */
  ALLOWED_ORIGINS?: string;
  /** Override for local development against the mock GitHub. */
  GITHUB_OAUTH_BASE?: string;
  RATE_PER_MINUTE?: string;
}

export interface Deps {
  fetch?: typeof fetch;
  now?: () => number;
}

const CODE = /^[A-Za-z0-9_-]{6,128}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

/**
 * The only server-side code behind the hosted builder. It exists because GitHub's token endpoint
 * needs the app's client secret. It validates the caller's origin, rate-limits, forwards the
 * exchange (with PKCE), and returns just the token fields. It stores and logs nothing.
 */
export function createApp(env: Env, deps: Deps = {}) {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const origins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const oauthBase = (env.GITHUB_OAUTH_BASE ?? 'https://github.com').replace(/\/+$/, '');
  const rate = Number(env.RATE_PER_MINUTE ?? 20);
  const buckets = new Map<string, { start: number; n: number }>();
  const app = new Hono();

  const limited = (key: string) => {
    const t = now();
    const b = buckets.get(key);
    if (!b || t - b.start >= 60_000) {
      buckets.set(key, { start: t, n: 1 });
      if (buckets.size > 5000)
        for (const [k, v] of buckets) if (t - v.start >= 60_000) buckets.delete(k);
      return false;
    }
    b.n++;
    return b.n > rate;
  };

  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && origins.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
    }
    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'content-type');
      c.header('Access-Control-Max-Age', '600');
      return c.body(null, 204);
    }
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });

  app.get('/healthz', (c) =>
    c.json({
      ok: true,
      configured: Boolean(env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET),
    }),
  );

  app.post('/auth/token', async (c) => {
    if (!env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET) {
      return c.json(
        { error: 'not_configured', message: 'GitHub App credentials are not set on the server' },
        503,
      );
    }
    const origin = c.req.header('origin');
    if (!origin || !origins.includes(origin)) return c.json({ error: 'forbidden_origin' }, 403);

    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    if (limited(ip)) return c.json({ error: 'rate_limited' }, 429);

    let body: { code?: unknown; redirect_uri?: unknown; code_verifier?: unknown };
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      return c.json({ error: 'invalid_request', message: 'Expected JSON' }, 400);
    }
    const { code, redirect_uri, code_verifier } = body;
    if (typeof code !== 'string' || !CODE.test(code))
      return c.json({ error: 'invalid_request', message: 'Bad code' }, 400);
    if (typeof code_verifier !== 'string' || !VERIFIER.test(code_verifier))
      return c.json({ error: 'invalid_request', message: 'PKCE code_verifier is required' }, 400);
    if (typeof redirect_uri !== 'string')
      return c.json({ error: 'invalid_request', message: 'redirect_uri is required' }, 400);
    let redirectOrigin: string;
    try {
      redirectOrigin = new URL(redirect_uri).origin;
    } catch {
      return c.json({ error: 'invalid_request', message: 'Bad redirect_uri' }, 400);
    }
    // The redirect must land on an allowed origin, and match the caller.
    if (!origins.includes(redirectOrigin) || redirectOrigin !== origin)
      return c.json({ error: 'invalid_request', message: 'redirect_uri is not allowed' }, 400);

    let res: Response;
    try {
      res = await f(`${oauthBase}/login/oauth/access_token`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_APP_CLIENT_ID,
          client_secret: env.GITHUB_APP_CLIENT_SECRET,
          code,
          redirect_uri,
          code_verifier,
        }),
      });
    } catch {
      return c.json({ error: 'upstream_unreachable' }, 502);
    }
    let data: {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
      error?: string;
      error_description?: string;
    } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      return c.json({ error: 'upstream_invalid' }, 502);
    }
    if (!res.ok || data.error || !data.access_token) {
      // GitHub's error codes are safe to pass on (bad_verification_code, redirect_uri_mismatch, ...).
      return c.json(
        {
          error: 'exchange_failed',
          reason: typeof data.error === 'string' ? data.error : 'unknown',
        },
        400,
      );
    }
    return c.json({
      access_token: data.access_token,
      expires_in: data.expires_in ?? 28800,
      token_type: data.token_type ?? 'bearer',
    });
  });

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  return app;
}
