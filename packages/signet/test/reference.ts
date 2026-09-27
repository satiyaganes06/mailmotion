import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** The Signet reference page, byte for byte as published. */
export const REFERENCE_HTML = readFileSync(
  new URL('./fixtures/signet-reference.html', import.meta.url),
  'utf8',
);

interface RefDesign {
  id: string;
  name: string;
  use: string;
  w: number;
  h: number;
  alt: (d: unknown) => string;
  anim: (d: unknown, a: string) => string;
  layout: (d: unknown, a: string, slot: string) => string;
}

/**
 * Evaluate the reference page's own template code (everything from its `esc` helper to the end of
 * its `designs` array) in a sandbox, so tests compare our port against the original, not a copy.
 */
export function loadReference(): { designs: RefDesign[]; esc: (s: unknown) => string } {
  const start = REFERENCE_HTML.indexOf('const esc =');
  const designsAt = REFERENCE_HTML.indexOf('const designs = [');
  const end = REFERENCE_HTML.indexOf('\n];', designsAt) + 3;
  if (start < 0 || designsAt < 0 || end < designsAt) throw new Error('reference script not found');
  const code = `${REFERENCE_HTML.slice(start, end)}\n;({ designs, esc })`;
  return vm.runInNewContext(code, {}) as { designs: RefDesign[]; esc: (s: unknown) => string };
}

/** The reference's preview and export markup for one design (mirrors its `render()`). */
export function referenceRender(
  ref: ReturnType<typeof loadReference>,
  id: string,
  d: Record<string, string>,
  a: string,
  base: string,
): { preview: string; exported: string } {
  const t = ref.designs.find((x) => x.id === id)!;
  const preview = `<span class="anim" style="width:${t.w}px;height:${t.h}px">${t.anim(d, a)}</span>`;
  const img = `<img src="${ref.esc(base)}/${t.id}.gif" width="${t.w}" height="${t.h}" alt="${ref.esc(t.alt(d))}" style="display:block;border:0;outline:none;text-decoration:none;width:${t.w}px;height:${t.h}px;">`;
  return {
    preview: t.layout(d, a, preview),
    exported: `<!-- Signet: ${t.id} -->\n` + t.layout(d, a, img),
  };
}
