import { createCanvas } from '@napi-rs/canvas';
import { GIFEncoder } from 'gifenc';
import { GifReader } from 'omggif';
import { describe, expect, it } from 'vitest';
import { crc32, sanitizeImage, sniffKind } from '../src';

function makeGif(frames = 2, w = 8, h = 8): Uint8Array {
  const gif = GIFEncoder();
  const palette = [
    [255, 0, 0],
    [0, 0, 255],
    [0, 0, 0],
  ];
  for (let f = 0; f < frames; f++) {
    const idx = new Uint8Array(w * h).fill(f % 2);
    gif.writeFrame(idx, w, h, { palette: f === 0 ? palette : undefined, delay: 100, repeat: 0 });
  }
  gif.finish();
  return gif.bytes();
}

/** Insert raw bytes right after the GIF header/LSD/GCT (before the first block). */
function gifWithBlocks(gif: Uint8Array, extra: number[]): Uint8Array {
  const packed = gif[10]!;
  const start = 13 + (packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0);
  return Uint8Array.from([...gif.slice(0, start), ...extra, ...gif.slice(start)]);
}

const COMMENT = [0x21, 0xfe, 5, ...Buffer.from('hello'), 0]; // comment extension
const EVIL_APP = [0x21, 0xff, 11, ...Buffer.from('EVILAPP1.0\0'), 3, 1, 2, 3, 0]; // unknown application extension
const PLAIN_TEXT = [0x21, 0x01, 12, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 2, 65, 66, 0];

describe('sniffKind', () => {
  it('identifies GIF and PNG by magic bytes only', () => {
    expect(sniffKind(makeGif())).toBe('gif');
    expect(sniffKind(createCanvas(2, 2).toBuffer('image/png'))).toBe('png');
    expect(sniffKind(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffKind(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(sniffKind(new Uint8Array(0))).toBeNull();
  });
});

describe('GIF sanitizing', () => {
  it('leaves a clean gifenc file byte-identical (so content hashes stay stable)', () => {
    const g = makeGif();
    const r = sanitizeImage(g);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Buffer.from(r.bytes).equals(Buffer.from(g))).toBe(true);
      expect(r).toMatchObject({ kind: 'gif', width: 8, height: 8, frames: 2 });
    }
  });

  it('strips comments, plain-text and unknown application extensions but keeps NETSCAPE looping', () => {
    const dirty = gifWithBlocks(makeGif(), [...COMMENT, ...EVIL_APP, ...PLAIN_TEXT]);
    const r = sanitizeImage(dirty);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = Buffer.from(r.bytes).toString('latin1');
    expect(s).not.toContain('hello');
    expect(s).not.toContain('EVILAPP');
    expect(s).toContain('NETSCAPE2.0');
    expect(r.bytes.length).toBeLessThan(dirty.length);
    // still a valid, animated GIF with the same frames
    const rd = new GifReader(Buffer.from(r.bytes));
    expect(rd.numFrames()).toBe(2);
    expect(rd.loopCount()).toBe(0);
  });

  it('rejects truncated files, bad blocks and zero-size canvases', () => {
    const g = makeGif();
    expect(sanitizeImage(g.slice(0, g.length - 5)).ok).toBe(false);
    expect(sanitizeImage(g.slice(0, 10)).ok).toBe(false);
    const bad = Uint8Array.from(g);
    bad[13 + 3 * 4] = 0x99; // clobber the first block tag
    expect(sanitizeImage(bad).ok).toBe(false);
    const zero = Uint8Array.from(g);
    zero[6] = zero[7] = 0;
    expect(sanitizeImage(zero).ok).toBe(false);
  });

  it('enforces frame, dimension and byte caps', () => {
    expect(sanitizeImage(makeGif(5), { maxFrames: 3 }).ok).toBe(false);
    const huge = Uint8Array.from(makeGif());
    huge[6] = 0xff;
    huge[7] = 0x3f; // 16383 px wide
    const r = sanitizeImage(huge);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dimensions/);
    expect(sanitizeImage(makeGif(), { maxBytes: 20 }).ok).toBe(false);
  });

  it('rejects a frame bigger than the canvas', () => {
    const g = Uint8Array.from(makeGif());
    const packed = g[10]!;
    const tag = 13 + (packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0);
    // find the first image descriptor (0x2C) at/after the NETSCAPE + GCE blocks
    let p = tag;
    while (g[p] !== 0x2c) p++;
    g[p + 5] = 0xff; // frame width 255 > canvas 8
    expect(sanitizeImage(g).ok).toBe(false);
  });
});

/** Build a PNG chunk with a correct CRC. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(Buffer.from(type, 'latin1'), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Splice extra chunks in before IEND. */
function pngWithChunks(png: Uint8Array, extra: Uint8Array[]): Uint8Array {
  const iend = png.length - 12;
  return Uint8Array.from([
    ...png.slice(0, iend),
    ...extra.flatMap((c) => [...c]),
    ...png.slice(iend),
  ]);
}

describe('PNG sanitizing', () => {
  const png = () => createCanvas(16, 16).toBuffer('image/png');

  it('accepts a clean PNG and reports its size', () => {
    const r = sanitizeImage(png());
    expect(r).toMatchObject({ ok: true, kind: 'png', width: 16, height: 16 });
  });

  it('removes metadata chunks (EXIF/GPS, text, unknown) and keeps a decodable image', () => {
    const exif = chunk('eXIf', Buffer.from('GPS:3.1390N,101.6869E'));
    const text = chunk('tEXt', Buffer.from('Comment\0secret'));
    const unknown = chunk('zzZz', Buffer.from('hidden'));
    const dirty = pngWithChunks(png(), [exif, text, unknown]);
    const r = sanitizeImage(dirty);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = Buffer.from(r.bytes).toString('latin1');
    expect(s).not.toContain('GPS');
    expect(s).not.toContain('secret');
    expect(s).not.toContain('hidden');
    expect(r.bytes.length).toBeLessThan(dirty.length);
    // idempotent: sanitizing the result again changes nothing
    const again = sanitizeImage(r.bytes);
    expect(again.ok && Buffer.from(again.bytes).equals(Buffer.from(r.bytes))).toBe(true);
  });

  it('rejects bad checksums, truncation, missing IEND and oversized dimensions', () => {
    const p = Uint8Array.from(png());
    const corrupt = Uint8Array.from(p);
    corrupt[20] ^= 0xff; // inside IHDR data
    expect(sanitizeImage(corrupt).ok).toBe(false);
    expect(sanitizeImage(p.slice(0, p.length - 20)).ok).toBe(false);
    expect(sanitizeImage(p.slice(0, p.length - 12)).ok).toBe(false);
    // 60000 x 60000 IHDR with a valid CRC
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, 60000);
    dv.setUint32(4, 60000);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const bomb = Uint8Array.from([
      ...p.slice(0, 8),
      ...chunk('IHDR', ihdr),
      ...chunk('IDAT', new Uint8Array(4)),
      ...chunk('IEND', new Uint8Array(0)),
    ]);
    const r = sanitizeImage(bomb);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dimensions/);
  });

  it('honours the expected type and rejects disguised content', () => {
    expect(sanitizeImage(png(), { expected: 'gif' }).ok).toBe(false);
    expect(sanitizeImage(Buffer.from('<script>alert(1)</script>'), { expected: 'png' }).ok).toBe(
      false,
    );
    expect(sanitizeImage(Buffer.from('GIF89a<script>')).ok).toBe(false);
  });
});
