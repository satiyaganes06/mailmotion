import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Path2D, createCanvas, loadImage } from '@napi-rs/canvas';
import type { CanvasLike, Ctx2D } from '@mailmotion/animations';
import type { RenderEnv } from './env';

export interface NodeEnvOptions {
  /** Directory containing the `.ttf` files from `@mailmotion/ink`. Defaults to the installed package. */
  fontsDir?: string;
}

function defaultFontsDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('@mailmotion/ink/package.json')), 'fonts');
}

function decodeDataUrl(dataUrl: string): Buffer {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error('Expected a base64 image data URL');
  return Buffer.from(m[1]!, 'base64');
}

/** Render environment backed by `@napi-rs/canvas` (Skia): no browser needed. */
export function createNodeEnv(opts: NodeEnvOptions = {}): RenderEnv {
  const fontsDir = opts.fontsDir ?? defaultFontsDir();
  return {
    path2d: (d) => new Path2D(d) as unknown as globalThis.Path2D,
    createCanvas(width, height) {
      const canvas = createCanvas(width, height);
      return {
        canvas: canvas as unknown as CanvasLike,
        ctx: canvas.getContext('2d') as unknown as Ctx2D,
      };
    },
    async loadImage(dataUrl) {
      return (await loadImage(decodeDataUrl(dataUrl))) as unknown as CanvasLike;
    },
    async loadFont(file) {
      const buf = await readFile(join(fontsDir, file));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    },
    async encodePng(canvas) {
      const buf = (canvas as unknown as { toBuffer(mime: 'image/png'): Buffer }).toBuffer(
        'image/png',
      );
      return new Uint8Array(buf);
    },
    async sha256(bytes) {
      return createHash('sha256').update(bytes).digest('hex');
    },
  };
}
