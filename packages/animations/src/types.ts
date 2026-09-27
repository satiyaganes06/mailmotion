import type { Paint } from '@mailmotion/schema';

/**
 * Minimal structural canvas types so the same draw code runs against a browser
 * `CanvasRenderingContext2D`, an `OffscreenCanvasRenderingContext2D` (Web Worker) and
 * `@napi-rs/canvas` in Node.
 */
export type Ctx2D = CanvasRenderingContext2D;

export interface CanvasLike {
  width: number;
  height: number;
}

/** Services the draw code needs from its host environment. */
export interface DrawEnv {
  /** Build a path from SVG path data. */
  path2d(d: string): Path2D;
  /** A fresh offscreen canvas and its 2D context. */
  createCanvas(width: number, height: number): { canvas: CanvasLike; ctx: Ctx2D };
}

/** Text converted to SVG path data (baseline at y = 0, y grows downward), independent of system fonts. */
export interface TextPath {
  d: string;
  width: number;
  /** Distance from the baseline up to the top of the tallest glyph (positive). */
  ascent: number;
  /** Distance from the baseline down to the lowest descender (positive). */
  descent: number;
}

/** One frame of an animation: the loop position and how long it stays on screen. */
export interface Frame {
  /** 0 <= t < 1. `t = 0` is always the complete state (classic Outlook shows only frame 1). */
  t: number;
  delayMs: number;
}

export type Speed = 'slow' | 'normal' | 'fast';

/** Per-frame delay by speed. All are >= 90ms, i.e. at most 11.1 fps, under the 12 fps cap. */
export const FRAME_DELAY_MS: Record<Speed, number> = { slow: 160, normal: 110, fast: 90 };

export type Shape = 'circle' | 'rounded' | 'square' | 'squircle';

export interface AvatarParams {
  env: DrawEnv;
  /** Side of the square slot, in canvas pixels (already multiplied by the render scale). */
  size: number;
  shape: Shape;
  /** Pre-cropped, pre-filtered photo, `size x size`. */
  image?: CanvasLike | null;
  /** Initials converted to path data (used when there is no photo). */
  initials?: TextPath | null;
  accent: string;
  secondary: string;
  ring: Paint;
}

export interface AvatarAnimation {
  frames: number;
  draw(ctx: Ctx2D, p: AvatarParams, t: number): void;
}

export interface BannerParams {
  env: DrawEnv;
  width: number;
  height: number;
  kind: 'wave' | 'ticker' | 'shimmer' | 'static';
  colorA: string;
  colorB: string;
  /** Banner text converted to path data (for wave/ticker/shimmer). */
  text?: TextPath | null;
  /** Colour for the text. */
  textColor: string;
  /** Uploaded image for `static` banners. */
  image?: CanvasLike | null;
}
