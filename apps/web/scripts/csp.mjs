/**
 * Post-build: add a strict CSP to every exported HTML page and write `_headers` for hosts that
 * support it (Netlify, Cloudflare Pages). Run automatically by `pnpm build`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS, addCsp } from './csp-lib.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');

// Optional analytics script origin (built into the pages via NEXT_PUBLIC_ANALYTICS_SRC).
let extra = [];
try {
  if (process.env.NEXT_PUBLIC_ANALYTICS_SRC)
    extra = [new URL(process.env.NEXT_PUBLIC_ANALYTICS_SRC).origin];
} catch {
  /* ignore */
}

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.html')) yield p;
  }
}

let n = 0;
for (const file of walk(out)) {
  writeFileSync(file, addCsp(readFileSync(file, 'utf8'), { extraScriptSrc: extra }));
  n++;
}

const headers = Object.entries(SECURITY_HEADERS)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n');
writeFileSync(
  join(out, '_headers'),
  `/*\n${headers}\n  Content-Security-Policy: frame-ancestors 'none'\n\n/phone/*\n  X-Robots-Tag: noindex, nofollow\n\n/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
);
console.log(`csp: added a strict CSP to ${n} pages and wrote out/_headers`);
