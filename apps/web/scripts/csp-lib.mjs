import { createHash } from 'node:crypto';

/**
 * Build a strict Content-Security-Policy for the static export.
 * Scripts: only our own origin plus the exact inline scripts Next.js emitted (by hash), so an
 * injected script cannot run and read the in-memory GitHub token.
 */
export function buildCsp({ inlineScriptHashes, extraScriptSrc = [] }) {
  const hashes = inlineScriptHashes.map((h) => `'sha256-${h}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes, ...extraScriptSrc].join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http://localhost:*",
    "font-src 'self'",
    // user-chosen storage servers and GitHub are reached with fetch; scripts are locked, so this is
    // not an exfiltration path for injected code
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}

const SCRIPT_RE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;

/** Hashes (base64 sha256) of every inline `<script>` body in the document. */
export function inlineScriptHashes(html) {
  const out = new Set();
  for (const m of html.matchAll(SCRIPT_RE)) {
    const attrs = m[1] ?? '';
    // JSON data blocks (type="application/json" etc.) are not executed and need no hash
    if (/\btype=["'](?!module|text\/javascript)[^"']*["']/i.test(attrs)) continue;
    out.add(
      createHash('sha256')
        .update(m[2] ?? '', 'utf8')
        .digest('base64'),
    );
  }
  return [...out];
}

/** Insert the CSP `<meta>` as the first child of `<head>` (replacing any previous one). */
export function addCsp(html, opts = {}) {
  const csp = buildCsp({
    inlineScriptHashes: inlineScriptHashes(html),
    extraScriptSrc: opts.extraScriptSrc,
  });
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}"/>`;
  const stripped = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  if (!/<head[^>]*>/i.test(stripped)) return stripped;
  return stripped.replace(/<head([^>]*)>/i, (m) => `${m}${meta}`);
}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};
