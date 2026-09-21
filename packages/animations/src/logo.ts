import type { CanvasLike, Ctx2D, Frame, Speed } from './types';
import { FRAME_DELAY_MS } from './types';
import { lerp, window01 } from './util';

const FRAMES = 20;

/** Draw a logo; a light sweep passes over its opaque pixels between t = 0.3 and t = 0.85. */
export function drawLogo(
  ctx: Ctx2D,
  image: CanvasLike,
  width: number,
  height: number,
  t: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image as unknown as CanvasImageSource, 0, 0, width, height);
  const q = window01(0.3, 0.85, t);
  if (q <= 0 || q >= 1) return;
  const bandW = width * 0.35;
  const x = lerp(-bandW, width + bandW, q);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(x - bandW, 0, x + bandW, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function logoTimeline(speed: Speed): Frame[] {
  const delayMs = FRAME_DELAY_MS[speed];
  return Array.from({ length: FRAMES }, (_, i) => ({ t: i / FRAMES, delayMs }));
}
