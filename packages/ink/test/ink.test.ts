import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INK_FONTS,
  UI_FONT_FILE,
  contourLengths,
  drawTypedInk,
  inkTimeline,
  layoutInk,
  loadFont,
  markText,
  textPath,
} from '../src';
import { createConfig } from '@mailmotion/schema';

const dir = join(import.meta.dirname, '..', 'fonts');
const loader = async (file: string) => {
  const b = await readFile(join(dir, file));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe('fonts', () => {
  it('lists the 10 script fonts and every file exists and parses', async () => {
    expect(INK_FONTS).toHaveLength(10);
    for (const f of INK_FONTS) {
      const font = await loadFont(loader, f.file);
      expect(font.glyphs.length).toBeGreaterThan(50);
    }
  });

  it('never produces NaN in glyph outlines (regression: variable-font control points)', async () => {
    for (const f of INK_FONTS) {
      const font = await loadFont(loader, f.file);
      for (const text of ['Shatthiya Ganes', 'Ada Lovelace', 'Grace Hopper-Smith', 'Zoë Åström']) {
        const layout = layoutInk(font, text, 300, 74);
        expect(layout.glyphs.length).toBeGreaterThan(3);
        for (const g of layout.glyphs) {
          expect(g.d, `${f.id}: ${text}`).not.toMatch(/NaN|Infinity/);
          expect(Number.isFinite(g.length)).toBe(true);
        }
      }
    }
  });

  it('textPath for initials has no NaN and positive size', async () => {
    const font = await loadFont(loader, UI_FONT_FILE);
    const t = textPath(font, 'SG');
    expect(t.d).not.toMatch(/NaN/);
    expect(t.width).toBeGreaterThan(20);
    expect(t.ascent).toBeGreaterThan(0);
  });
});

describe('layout', () => {
  it('fits the word inside the box with padding', async () => {
    const font = await loadFont(loader, 'DancingScript.ttf');
    const l = layoutInk(font, 'Shatthiya Ganes', 300, 74);
    const min = Math.min(...l.glyphs.map((g) => g.minX));
    const max = Math.max(...l.glyphs.map((g) => g.maxX));
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(300);
  });
  it('contourLengths measures a unit square', () => {
    const cmds = [
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 10, y: 10 },
      { type: 'L', x: 0, y: 10 },
      { type: 'Z' },
    ] as never;
    expect(contourLengths(cmds)[0]).toBeCloseTo(40, 5);
  });
});

describe('markText', () => {
  const c = (mark: object) =>
    createConfig({ details: { fullName: 'Ada King Lovelace' }, mark } as never);
  it('supports full, first, initials and custom', () => {
    expect(markText(c({ text: 'full' }))).toBe('Ada King Lovelace');
    expect(markText(c({ text: 'first' }))).toBe('Ada');
    expect(markText(c({ text: 'initials' }))).toBe('AKL');
    expect(markText(c({ text: 'custom', customText: 'A.L.' }))).toBe('A.L.');
  });
});

describe('inkTimeline', () => {
  it('starts on the complete frame with the hold delay', () => {
    const { frames, loopCount } = inkTimeline({
      animation: 'ink',
      speed: 'normal',
      holdMs: 1500,
      loop: 'forever',
    });
    expect(frames[0]).toMatchObject({ progress: 1, delayMs: 1500 });
    expect(loopCount).toBe(0);
    expect(frames.length).toBeGreaterThan(10);
    for (const f of frames.slice(1)) {
      expect(f.progress).toBeGreaterThan(0);
      expect(f.progress).toBeLessThan(1);
      expect(f.delayMs).toBeGreaterThanOrEqual(90); // <= 11.1 fps
    }
  });
  it('finite loops end on a complete, held frame', () => {
    const { frames, loopCount } = inkTimeline({
      animation: 'ink',
      speed: 'fast',
      holdMs: 500,
      loop: 'three',
    });
    const last = frames.at(-1)!;
    expect(last.progress).toBe(1);
    expect(last.delayMs).toBeGreaterThanOrEqual(2000);
    expect(loopCount).toBe(2);
  });
  it('static marks are a single complete frame', () => {
    const { frames } = inkTimeline({
      animation: 'none',
      speed: 'normal',
      holdMs: 0,
      loop: 'forever',
    });
    expect(frames).toEqual([{ t: 1, progress: 1, delayMs: 0 }]);
  });
  it('drawTypedInk is exported', () => expect(typeof drawTypedInk).toBe('function'));
});
