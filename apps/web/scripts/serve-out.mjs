/** Tiny static server for the exported site (used by `pnpm start` and the Playwright tests). */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS } from './csp-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const port = Number(process.env.PORT ?? 3000);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, p);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) {
    const nf = join(root, '404.html');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return void res.end(existsSync(nf) ? readFileSync(nf) : 'Not found');
  }
  const headers = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    ...SECURITY_HEADERS,
  };
  if (file.includes(`${join('_next', 'static')}`))
    headers['cache-control'] = 'public, max-age=31536000, immutable';
  if (p.startsWith('/phone')) headers['x-robots-tag'] = 'noindex, nofollow';
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
