import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCompat, getDoc, listDocs } from '../src/lib/docs';

describe('docs', () => {
  it('renders every markdown page with a title and content', () => {
    const docs = listDocs();
    expect(docs.length).toBeGreaterThanOrEqual(8);
    for (const d of docs) {
      expect(d.title.length).toBeGreaterThan(2);
      expect(d.html).toContain('<h1');
      expect(d.html.length).toBeGreaterThan(300);
    }
    expect(docs.map((d) => d.order)).toEqual([...docs.map((d) => d.order)].sort((a, b) => a - b));
    expect(getDoc('getting-started')?.title).toBe('Getting started');
    expect(getDoc('nope')).toBeUndefined();
  });

  it('every internal link points at a page that exists', () => {
    const slugs = new Set(listDocs().map((d) => d.slug));
    const ok = (href: string) => {
      const path = href.split('#')[0]!;
      if (path === '/studio/' || path === '/compat/' || path === '/' || path === '/docs/')
        return true;
      const m = /^\/docs\/([a-z-]+)\/$/.exec(path);
      return Boolean(m && slugs.has(m[1]!));
    };
    const all = [...listDocs().map((d) => d.html), getCompat().html];
    const hrefs = all.flatMap((h) => [...h.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]!));
    expect(hrefs.length).toBeGreaterThan(5);
    for (const h of hrefs) expect(ok(h), `broken internal link: ${h}`).toBe(true);
  });

  it('the compatibility page is honest about the untested matrix', () => {
    const html = getCompat().html;
    expect(html).toContain('not yet verified on real devices');
    expect(html).toContain('⬜');
    expect(html).not.toContain('✅ Gmail'); // no fabricated pass results
  });

  it('documents every environment variable the servers read', () => {
    const doc = getDoc('self-hosting')!.html;
    for (const v of [
      'MM_STORAGE',
      'MM_PUBLIC_BASE_URL',
      'MM_UPLOAD_TOKEN',
      'MM_ALLOWED_ORIGINS',
      'MM_DATA_DIR',
      'MM_TRUST_PROXY',
      'MM_S3_ENDPOINT',
    ])
      expect(doc).toContain(v);
    const example = readFileSync(join(process.cwd(), '..', '..', '.env.example'), 'utf8');
    for (const v of ['MM_STORAGE', 'MM_PUBLIC_BASE_URL', 'MM_UPLOAD_TOKEN'])
      expect(example).toContain(v);
  });

  it('the docs folder has only markdown plus the compat folder', () => {
    const dir = join(process.cwd(), '..', '..', 'docs');
    for (const f of readdirSync(dir)) expect(f.endsWith('.md') || f === 'compat').toBe(true);
    expect(existsSync(join(dir, 'compat', 'index.md'))).toBe(true);
  });
});
