import opentype from 'opentype.js';
import type { TextPath } from '@mailmotion/animations';
import type { FontLoader } from './fonts';

export type Font = opentype.Font;
type Cmd = opentype.PathCommand;

const cache = new Map<string, Promise<Font>>();

/** Load and parse a font once per loader+file. */
export function loadFont(loader: FontLoader, file: string): Promise<Font> {
  const key = file;
  let p = cache.get(key);
  if (!p) {
    p = loader(file).then((buf) => opentype.parse(buf));
    cache.set(key, p);
  }
  return p;
}

/**
 * Defensive repair of missing/non-finite coordinates in a path's commands (interpolated from the
 * neighbouring points of the same contour). Belt and braces alongside `toData`.
 */
export function repairPath(path: opentype.Path): opentype.Path {
  const cmds = path.commands as unknown as Record<string, number | string | undefined>[];
  const required: Record<string, string[]> = {
    M: ['x', 'y'],
    L: ['x', 'y'],
    Q: ['x1', 'y1', 'x', 'y'],
    C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
  };
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i]!;
    for (const f of required[c.type as string] ?? []) {
      if (finite(c[f])) continue;
      const axis = f.startsWith('x') ? 'x' : 'y';
      let prev: number | undefined;
      for (let j = i - 1; j >= 0 && prev === undefined; j--) {
        const e = cmds[j]![axis];
        if (finite(e)) prev = e;
      }
      let next: number | undefined;
      for (let j = i + 1; j < cmds.length && next === undefined; j++) {
        if (cmds[j]!.type === 'M') break;
        const e = cmds[j]![axis];
        if (finite(e)) next = e;
      }
      c[f] = prev !== undefined && next !== undefined ? (prev + next) / 2 : (prev ?? next ?? 0);
    }
  }
  return path;
}

/**
 * Serialize commands to absolute SVG path data ourselves: `Path.toPathData` (opentype.js) can emit
 * NaN for degenerate curves in some fonts, which canvases then silently drop.
 */
function toData(path: opentype.Path): string {
  const n = (v: number) => (Math.round(v * 100) / 100).toString();
  let d = '';
  for (const c of path.commands as unknown as Record<string, number | string>[]) {
    switch (c.type) {
      case 'M':
        d += `M${n(c.x as number)} ${n(c.y as number)}`;
        break;
      case 'L':
        d += `L${n(c.x as number)} ${n(c.y as number)}`;
        break;
      case 'Q':
        d += `Q${n(c.x1 as number)} ${n(c.y1 as number)} ${n(c.x as number)} ${n(c.y as number)}`;
        break;
      case 'C':
        d += `C${n(c.x1 as number)} ${n(c.y1 as number)} ${n(c.x2 as number)} ${n(c.y2 as number)} ${n(c.x as number)} ${n(c.y as number)}`;
        break;
      case 'Z':
        d += 'Z';
        break;
    }
  }
  return d;
}

/**
 * Per-glyph outlines for `text`. Uses opentype.js shaping (ligatures, kerning) and falls back to
 * plain per-character layout when a font's GSUB tables use lookups opentype.js cannot read
 * (it throws for some accented input).
 */
export function safePaths(
  font: Font,
  text: string,
  x: number,
  y: number,
  size: number,
): opentype.Path[] {
  try {
    return font.getPaths(text, x, y, size).map(repairPath);
  } catch {
    const scale = size / font.unitsPerEm;
    const out: opentype.Path[] = [];
    let cx = x;
    let prev: opentype.Glyph | null = null;
    for (const ch of Array.from(text)) {
      const g = font.charToGlyph(ch);
      if (prev) cx += font.getKerningValue(prev, g) * scale;
      out.push(repairPath(g.getPath(cx, y, size)));
      cx += (g.advanceWidth ?? 0) * scale;
      prev = g;
    }
    return out;
  }
}

function mergedBox(paths: opentype.Path[]): { x1: number; y1: number; x2: number; y2: number } {
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  for (const p of paths) {
    if (!p.commands.length) continue;
    const b = p.getBoundingBox();
    box.x1 = Math.min(box.x1, b.x1);
    box.y1 = Math.min(box.y1, b.y1);
    box.x2 = Math.max(box.x2, b.x2);
    box.y2 = Math.max(box.y2, b.y2);
  }
  return Number.isFinite(box.x1) ? box : { x1: 0, y1: 0, x2: 1, y2: 1 };
}

/** Text as one SVG path (baseline at y = 0). Used for initials and banner text. */
export function textPath(font: Font, text: string, fontSize = 100): TextPath {
  const paths = safePaths(font, text, 0, 0, fontSize);
  const box = mergedBox(paths);
  const d = paths.map(toData).join('');
  const advance = paths.length ? box.x2 : 0;
  return {
    d,
    width: Math.max(advance, box.x2 - Math.min(0, box.x1)),
    ascent: Math.max(0, -box.y1),
    descent: Math.max(0, box.y2),
  };
}

export interface Glyph {
  /** Outline as SVG path data, already positioned in canvas pixels. */
  d: string;
  /** Total outline length in pixels. */
  length: number;
  /** Longest single contour, used to time dash-based tracing. */
  maxContour: number;
  minX: number;
  maxX: number;
}

export interface InkLayout {
  glyphs: Glyph[];
  totalLength: number;
  width: number;
  height: number;
}

function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Lengths of each contour in a command list. */
export function contourLengths(commands: Cmd[]): number[] {
  const out: number[] = [];
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    len = 0,
    open = false;
  const flush = () => {
    if (open) out.push(len);
    len = 0;
    open = false;
  };
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        flush();
        x = sx = c.x!;
        y = sy = c.y!;
        open = true;
        break;
      case 'L':
        len += Math.hypot(c.x! - x, c.y! - y);
        x = c.x!;
        y = c.y!;
        break;
      case 'Q': {
        const steps = 12;
        let px = x,
          py = y;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps,
            u = 1 - t;
          const qx = u * u * x + 2 * u * t * c.x1! + t * t * c.x!;
          const qy = u * u * y + 2 * u * t * c.y1! + t * t * c.y!;
          len += Math.hypot(qx - px, qy - py);
          px = qx;
          py = qy;
        }
        x = c.x!;
        y = c.y!;
        break;
      }
      case 'C': {
        const steps = 16;
        let px = x,
          py = y;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const qx = bezier(x, c.x1!, c.x2!, c.x!, t);
          const qy = bezier(y, c.y1!, c.y2!, c.y!, t);
          len += Math.hypot(qx - px, qy - py);
          px = qx;
          py = qy;
        }
        x = c.x!;
        y = c.y!;
        break;
      }
      case 'Z':
        len += Math.hypot(sx - x, sy - y);
        x = sx;
        y = sy;
        break;
    }
  }
  flush();
  return out;
}

/**
 * Lay text out to fit a `width x height` box (centred, with padding), returning one outline per
 * glyph in canvas pixels. The font size is chosen so the whole word fits.
 */
export function layoutInk(font: Font, text: string, width: number, height: number): InkLayout {
  const probe = mergedBox(safePaths(font, text, 0, 0, 100));
  const bw = Math.max(1, probe.x2 - probe.x1);
  const bh = Math.max(1, probe.y2 - probe.y1);
  const scale = Math.min((width * 0.94) / bw, (height * 0.86) / bh);
  const size = 100 * scale;
  const ox = (width - bw * scale) / 2 - probe.x1 * scale;
  const baseline = (height - bh * scale) / 2 - probe.y1 * scale;

  const paths = safePaths(font, text, ox, baseline, size);
  const glyphs: Glyph[] = [];
  for (const p of paths) {
    if (!p.commands.length) continue;
    const lens = contourLengths(p.commands);
    const length = lens.reduce((a, b) => a + b, 0);
    if (length <= 0) continue;
    const box = p.getBoundingBox();
    glyphs.push({
      d: toData(p),
      length,
      maxContour: Math.max(...lens),
      minX: box.x1,
      maxX: box.x2,
    });
  }
  const totalLength = glyphs.reduce((a, g) => a + g.length, 0);
  return { glyphs, totalLength, width, height };
}
