import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

/** Markdown lives in the repo's top-level `docs/` folder (trusted content, rendered at build time). */
const DOCS_DIR = join(process.cwd(), '..', '..', 'docs');

export interface Doc {
  slug: string;
  title: string;
  order: number;
  html: string;
}

function parse(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

function render(file: string, slug: string): Doc {
  const { meta, body } = parse(readFileSync(file, 'utf8'));
  return {
    slug,
    title: meta.title ?? slug,
    order: Number(meta.order ?? 99),
    html: marked.parse(body, { async: false, gfm: true }) as string,
  };
}

export function listDocs(): Doc[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => render(join(DOCS_DIR, f), f.replace(/\.md$/, '')))
    .sort((a, b) => a.order - b.order);
}

export function getDoc(slug: string): Doc | undefined {
  return listDocs().find((d) => d.slug === slug);
}

export function getCompat(): Doc {
  return render(join(DOCS_DIR, 'compat', 'index.md'), 'compat');
}
