/**
 * Upload sanitizer for GIF and PNG files. It never trusts a client-supplied type or name:
 * it sniffs magic bytes, parses the container strictly, enforces byte/pixel caps, and rewrites the
 * file keeping only the blocks needed to display it (dropping comments, text, EXIF and unknown
 * application data).
 */

export type ImageKind = 'gif' | 'png';

export interface SanitizeOptions {
  maxBytes?: number;
  maxDimension?: number;
  maxPixels?: number;
  maxFrames?: number;
  /** If set, the sniffed type must match. */
  expected?: ImageKind;
}

export type SanitizeResult =
  | { ok: true; bytes: Uint8Array; kind: ImageKind; width: number; height: number; frames: number }
  | { ok: false; error: string };

export const DEFAULTS = {
  maxBytes: 2 * 1024 * 1024,
  maxDimension: 2048,
  maxPixels: 4_000_000,
  maxFrames: 300,
} as const;

const fail = (error: string): SanitizeResult => ({ ok: false, error });

export function sniffKind(b: Uint8Array): ImageKind | null {
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x39 || b[4] === 0x37) &&
    b[5] === 0x61
  )
    return 'gif';
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return 'png';
  return null;
}

export function sanitizeImage(input: Uint8Array, opts: SanitizeOptions = {}): SanitizeResult {
  const o = { ...DEFAULTS, ...opts };
  if (input.length === 0) return fail('Empty file');
  if (input.length > o.maxBytes) return fail(`File is larger than ${o.maxBytes} bytes`);
  const kind = sniffKind(input);
  if (!kind) return fail('Not a GIF or PNG (magic bytes do not match)');
  if (o.expected && o.expected !== kind)
    return fail(`Expected ${o.expected} but the file is ${kind}`);
  const r = kind === 'gif' ? sanitizeGif(input, o) : sanitizePng(input, o);
  if (r.ok && r.bytes.length > o.maxBytes) return fail('Sanitized file is too large');
  return r;
}

/* ------------------------------------------------------------------ GIF */

function skipSubBlocks(b: Uint8Array, p: number): number {
  for (;;) {
    if (p >= b.length) return -1;
    const n = b[p]!;
    p += 1 + n;
    if (n === 0) return p;
  }
}

function sanitizeGif(
  b: Uint8Array,
  o: Required<Omit<SanitizeOptions, 'expected'>>,
): SanitizeResult {
  if (b.length < 13) return fail('Truncated GIF');
  const width = b[6]! | (b[7]! << 8);
  const height = b[8]! | (b[9]! << 8);
  if (width === 0 || height === 0) return fail('GIF has zero size');
  if (width > o.maxDimension || height > o.maxDimension || width * height > o.maxPixels)
    return fail('GIF dimensions are too large');
  const packed = b[10]!;
  let p = 13;
  if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1));
  if (p > b.length) return fail('Truncated GIF (color table)');

  const out: number[][] = []; // list of [start, end) pairs flattened as arrays
  const keep = (s: number, e: number) => out.push([s, e]);
  keep(0, p); // header + logical screen descriptor + global color table
  let frames = 0;

  for (;;) {
    if (p >= b.length) return fail('Truncated GIF (no trailer)');
    const tag = b[p]!;
    if (tag === 0x3b) break;
    if (tag === 0x21) {
      const label = b[p + 1];
      if (label === undefined) return fail('Truncated GIF extension');
      const end = skipSubBlocks(b, p + 2);
      if (end < 0) return fail('Truncated GIF extension');
      if (label === 0xf9) {
        if (b[p + 2] !== 4) return fail('Malformed graphic control extension');
        keep(p, end);
      } else if (label === 0xff) {
        // keep only the looping extension
        const id = String.fromCharCode(...b.slice(p + 3, p + 3 + 11));
        if (b[p + 2] === 11 && id === 'NETSCAPE2.0') keep(p, end);
      } // comments (0xFE), plain text (0x01) and everything else are dropped
      p = end;
    } else if (tag === 0x2c) {
      if (p + 10 > b.length) return fail('Truncated GIF image');
      const iw = b[p + 5]! | (b[p + 6]! << 8);
      const ih = b[p + 7]! | (b[p + 8]! << 8);
      if (iw > width || ih > height) return fail('GIF frame is larger than the canvas');
      const ip = b[p + 9]!;
      let q = p + 10;
      if (ip & 0x80) q += 3 * (1 << ((ip & 7) + 1));
      q += 1; // LZW minimum code size
      if (q > b.length) return fail('Truncated GIF image');
      const end = skipSubBlocks(b, q);
      if (end < 0) return fail('Truncated GIF image data');
      keep(p, end);
      frames++;
      if (frames > o.maxFrames) return fail('Too many GIF frames');
      p = end;
    } else {
      return fail('Invalid GIF block');
    }
  }
  if (frames === 0) return fail('GIF has no frames');
  keep(p, p + 1); // trailer

  const total = out.reduce((a, [s, e]) => a + (e! - s!), 0);
  const res = new Uint8Array(total);
  let w = 0;
  for (const [s, e] of out) {
    res.set(b.subarray(s, e), w);
    w += e! - s!;
  }
  return { ok: true, bytes: res, kind: 'gif', width, height, frames };
}

/* ------------------------------------------------------------------ PNG */

let CRC_TABLE: Uint32Array | null = null;
export function crc32(buf: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (b: Uint8Array, p: number) =>
  ((b[p]! << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0;
const KEEP_PNG = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

function sanitizePng(
  b: Uint8Array,
  o: Required<Omit<SanitizeOptions, 'expected'>>,
): SanitizeResult {
  let p = 8;
  const kept: [number, number][] = [[0, 8]];
  let width = 0,
    height = 0,
    sawIdat = false,
    sawEnd = false,
    first = true;
  while (p + 12 <= b.length) {
    const len = u32(b, p);
    if (len > b.length) return fail('Malformed PNG chunk length');
    const type = String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!);
    const end = p + 12 + len;
    if (end > b.length) return fail('Truncated PNG');
    if (first && type !== 'IHDR') return fail('PNG must start with IHDR');
    const crc = u32(b, end - 4);
    if (crc32(b.subarray(p + 4, end - 4)) !== crc) return fail(`Bad PNG checksum in ${type}`);
    if (type === 'IHDR') {
      if (len !== 13) return fail('Malformed IHDR');
      width = u32(b, p + 8);
      height = u32(b, p + 12);
      if (width === 0 || height === 0) return fail('PNG has zero size');
      if (width > o.maxDimension || height > o.maxDimension || width * height > o.maxPixels)
        return fail('PNG dimensions are too large');
    }
    first = false;
    if (KEEP_PNG.has(type)) kept.push([p, end]);
    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') {
      sawEnd = true;
      break;
    }
    p = end;
  }
  if (!sawEnd) return fail('PNG has no IEND');
  if (!sawIdat) return fail('PNG has no image data');
  const total = kept.reduce((a, [s, e]) => a + (e - s), 0);
  const res = new Uint8Array(total);
  let w = 0;
  for (const [s, e] of kept) {
    res.set(b.subarray(s, e), w);
    w += e - s;
  }
  return { ok: true, bytes: res, kind: 'png', width, height, frames: 1 };
}

export const CONTENT_TYPES: Record<ImageKind, string> = { gif: 'image/gif', png: 'image/png' };
