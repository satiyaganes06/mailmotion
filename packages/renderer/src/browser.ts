import type { CanvasLike, Ctx2D } from '@mailmotion/animations';
import type { RenderEnv } from './env';

export interface BrowserEnvOptions {
  /** URL prefix the `.ttf` files are served from, e.g. `/fonts`. */
  fontBaseUrl: string;
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Render environment for the browser main thread or a Web Worker. Uses `OffscreenCanvas` when
 * available (workers), else a detached `<canvas>`.
 */
export function createBrowserEnv(opts: BrowserEnvOptions): RenderEnv {
  const base = opts.fontBaseUrl.replace(/\/+$/, '');
  return {
    path2d: (d) => new Path2D(d),
    createCanvas(width, height) {
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        return {
          canvas: canvas as unknown as CanvasLike,
          ctx: canvas.getContext('2d', { willReadFrequently: true }) as unknown as Ctx2D,
        };
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! };
    },
    async loadImage(dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      return (await createImageBitmap(blob)) as unknown as CanvasLike;
    },
    async loadFont(file) {
      const res = await fetch(`${base}/${file}`);
      if (!res.ok) throw new Error(`Could not load font ${file} (${res.status})`);
      return res.arrayBuffer();
    },
    async encodePng(canvas) {
      if (canvas instanceof OffscreenCanvas) {
        return new Uint8Array(
          await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
        );
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/png',
        ),
      );
      return new Uint8Array(await blob.arrayBuffer());
    },
    async sha256(bytes) {
      return hex(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
    },
  };
}
