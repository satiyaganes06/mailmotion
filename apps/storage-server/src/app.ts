import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { lintHtml } from '@mailmotion/serializer';
import {
  CONTENT_TYPES,
  FILE_NAME,
  IMMUTABLE_CACHE,
  sanitizeImage,
  sha256Hex,
  type StorageAdapter,
} from '@mailmotion/storage';

export interface ServerConfig {
  /** Shared secret required to upload (>= 16 characters). */
  uploadToken: string;
  /** Origins allowed to call the upload API from a browser (`*` allows any; not recommended). */
  allowedOrigins: string[];
  /** Directory for short-lived "send to my phone" shares. */
  dataDir: string;
  maxUploadBytes?: number;
  /** Requests per minute per client for POST endpoints. */
  ratePerMinute?: number;
  /** Trust `X-Forwarded-For` (set when running behind Caddy/nginx). */
  trustProxy?: boolean;
  shareTtlMs?: number;
}

export interface ServerDeps {
  now?: () => number;
}

const SHARE_ID = /^[a-f0-9]{32}$/;
const MAX_SHARE_HTML = 64 * 1024;

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function validateConfig(cfg: ServerConfig): void {
  if (!cfg.uploadToken || cfg.uploadToken.length < 16) {
    throw new Error(
      'MM_UPLOAD_TOKEN must be set to a secret of at least 16 characters (openssl rand -hex 32)',
    );
  }
  if (cfg.uploadToken === 'change-me')
    throw new Error('Refusing to start with the example MM_UPLOAD_TOKEN');
}

/**
 * The Path A storage server. Stateless apart from the adapter and short-lived shares.
 * Files are validated, sanitized, and stored under their content hash.
 */
export function createApp(
  cfg: ServerConfig,
  adapter: StorageAdapter & { read?: (n: string) => Promise<Buffer | null> },
  deps: ServerDeps = {},
) {
  validateConfig(cfg);
  const now = deps.now ?? Date.now;
  const maxBytes = cfg.maxUploadBytes ?? 2 * 1024 * 1024;
  const rate = cfg.ratePerMinute ?? 120;
  const ttl = cfg.shareTtlMs ?? 24 * 60 * 60 * 1000;
  const buckets = new Map<string, { start: number; n: number }>();

  const app = new Hono();

  const clientKey = (c: { req: { header(n: string): string | undefined } }) =>
    cfg.trustProxy ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'proxy') : 'local';

  const limited = (key: string): boolean => {
    const t = now();
    const b = buckets.get(key);
    if (!b || t - b.start >= 60_000) {
      buckets.set(key, { start: t, n: 1 });
      return false;
    }
    b.n++;
    return b.n > rate;
  };

  const originAllowed = (origin: string | undefined) =>
    !!origin && (cfg.allowedOrigins.includes('*') || cfg.allowedOrigins.includes(origin));

  // Security headers on everything, CORS for the API routes.
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  });

  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    const path = new URL(c.req.url).pathname;
    const isPublicRead =
      c.req.method !== 'POST' && (FILE_NAME.test(path.slice(1)) || path.startsWith('/share/'));
    if (isPublicRead) {
      c.header('Access-Control-Allow-Origin', '*');
    } else if (originAllowed(origin)) {
      c.header('Access-Control-Allow-Origin', origin!);
      c.header('Vary', 'Origin');
    }
    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'authorization, content-type');
      c.header('Access-Control-Max-Age', '600');
      return c.body(null, 204);
    }
    return next();
  });

  const authorized = (header: string | undefined) => {
    const m = /^Bearer (.+)$/.exec(header ?? '');
    return !!m && safeEqual(m[1]!, cfg.uploadToken);
  };

  app.get('/healthz', (c) => c.json({ ok: true, storage: adapter.kind }));

  app.post('/upload', async (c) => {
    if (!authorized(c.req.header('authorization'))) return c.json({ error: 'Unauthorized' }, 401);
    if (limited(`up:${clientKey(c)}`)) return c.json({ error: 'Too many requests' }, 429);

    const declared = Number(c.req.header('content-length') ?? '0');
    if (declared > maxBytes) return c.json({ error: 'File too large' }, 413);
    const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (type !== 'image/gif' && type !== 'image/png')
      return c.json({ error: 'Only image/gif and image/png are accepted' }, 415);

    const body = new Uint8Array(await c.req.arrayBuffer());
    const r = sanitizeImage(body, { maxBytes, expected: type === 'image/gif' ? 'gif' : 'png' });
    if (!r.ok) return c.json({ error: r.error }, 422);

    const name = `${await sha256Hex(r.bytes)}.${r.kind}`;
    const stored = await adapter.put({ name, bytes: r.bytes, contentType: CONTENT_TYPES[r.kind] });
    return c.json({ ...stored, kind: r.kind, width: r.width, height: r.height }, 201);
  });

  // Serve files (disk mode). In S3/R2 mode the CDN or bucket serves them.
  app.on(['GET', 'HEAD'], '/:name', async (c) => {
    const name = c.req.param('name');
    if (!FILE_NAME.test(name) || !adapter.read) return c.text('Not found', 404);
    const data = await adapter.read(name);
    if (!data) return c.text('Not found', 404);
    const type = name.endsWith('.gif') ? CONTENT_TYPES.gif : CONTENT_TYPES.png;
    c.header('Content-Type', type);
    c.header('Cache-Control', IMMUTABLE_CACHE);
    c.header('Content-Security-Policy', "default-src 'none'; sandbox");
    c.header('Content-Length', String(data.length));
    if (c.req.method === 'HEAD') return c.body(null);
    return c.body(new Uint8Array(data) as never);
  });

  /* ---------------------------------------------------------- "Send to my phone" */

  const shareDir = join(cfg.dataDir, 'share');

  app.post('/share', async (c) => {
    if (!authorized(c.req.header('authorization'))) return c.json({ error: 'Unauthorized' }, 401);
    if (limited(`sh:${clientKey(c)}`)) return c.json({ error: 'Too many requests' }, 429);
    let body: { html?: unknown };
    try {
      body = (await c.req.json()) as { html?: unknown };
    } catch {
      return c.json({ error: 'Expected JSON' }, 400);
    }
    if (typeof body.html !== 'string' || !body.html || body.html.length > MAX_SHARE_HTML) {
      return c.json({ error: 'html must be a string up to 64 KB' }, 400);
    }
    // The phone page renders this HTML, so only email-safe markup is accepted.
    const issues = lintHtml(body.html);
    if (issues.length) return c.json({ error: 'HTML rejected', issues: issues.slice(0, 5) }, 422);

    const token = randomBytes(16).toString('hex');
    const expiresAt = now() + ttl;
    await mkdir(shareDir, { recursive: true });
    await writeFile(
      join(shareDir, `${token}.json`),
      JSON.stringify({ html: body.html, expiresAt }),
      { mode: 0o600 },
    );
    return c.json({ token, expiresAt }, 201);
  });

  app.get('/share/:token', async (c) => {
    const token = c.req.param('token');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store');
    if (!SHARE_ID.test(token)) return c.json({ error: 'Not found' }, 404);
    const file = join(shareDir, `${token}.json`);
    try {
      const data = JSON.parse(await readFile(file, 'utf8')) as { html: string; expiresAt: number };
      if (data.expiresAt <= now()) {
        await rm(file, { force: true });
        return c.json({ error: 'This link has expired' }, 410);
      }
      return c.json(data);
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  app.notFound((c) => c.text('Not found', 404));
  return app;
}
