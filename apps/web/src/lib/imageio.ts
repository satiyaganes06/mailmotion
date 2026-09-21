import { LIMITS } from '@mailmotion/schema';

/** Accepted upload types. SVG is refused on purpose (it can carry script). */
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const OK_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

export class ImageError extends Error {}

/** Sniff the real type from magic bytes, regardless of the file's claimed type or extension. */
export function sniffImage(
  b: Uint8Array,
): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length > 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return 'image/gif';
  return null;
}

export interface LoadOptions {
  /** Longest side of the stored image, in px. */
  maxSide: number;
  /** Keep transparency (logos, signatures) vs. photo (JPEG, smaller). */
  transparent: boolean;
}

const toDataUrl = (c: HTMLCanvasElement, mime: string, q: number) => c.toDataURL(mime, q);

/**
 * Read an uploaded image, decode it (applying EXIF orientation), downscale and re-encode it.
 * Re-encoding through a canvas drops EXIF/GPS and any hidden payload. The result always fits the
 * config's data-URL size limit.
 */
export async function loadImageFile(file: File, opts: LoadOptions): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new ImageError('That file is too large (max 12 MB).');
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffImage(head);
  if (!kind || !OK_TYPES.has(kind)) throw new ImageError('Use a PNG, JPEG, WebP or GIF image.');

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('That image could not be read.');
  }
  let side = opts.maxSide;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext('2d')!;
    if (!opts.transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const url = opts.transparent
      ? toDataUrl(c, 'image/png', 1)
      : toDataUrl(c, 'image/jpeg', Math.max(0.6, 0.9 - attempt * 0.06));
    if (url.length <= LIMITS.imageDataUrlChars - 2000) {
      bmp.close?.();
      return url;
    }
    side = Math.round(side * 0.8);
  }
  bmp.close?.();
  throw new ImageError('That image is too detailed to embed. Try a smaller one.');
}

/** Decode a data URL to RGBA pixels (for signature vectorization). */
export async function dataUrlToRgba(
  dataUrl: string,
  maxSide = 600,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return { data: img.data, width: c.width, height: c.height };
}
