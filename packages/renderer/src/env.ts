import type { CanvasLike, Ctx2D, DrawEnv } from '@mailmotion/animations';
import type { FontLoader } from '@mailmotion/ink';

/** Everything the renderer needs from its host (browser/Web Worker or Node). */
export interface RenderEnv extends DrawEnv {
  /** Decode an image from a data URL (png/jpeg/webp/gif). */
  loadImage(dataUrl: string): Promise<CanvasLike>;
  /** Font file bytes, by file name (see `@mailmotion/ink`). */
  loadFont: FontLoader;
  /** Encode a canvas as PNG. */
  encodePng(canvas: CanvasLike): Promise<Uint8Array>;
  /** SHA-256 of bytes as lowercase hex. */
  sha256(bytes: Uint8Array): Promise<string>;
}

export interface Surface {
  canvas: CanvasLike;
  ctx: Ctx2D;
}

export function surface(env: RenderEnv, w: number, h: number): Surface {
  const { canvas, ctx } = env.createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  return { canvas, ctx };
}

export function pixels(s: Surface): Uint8ClampedArray {
  return s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
}
