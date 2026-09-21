import { GifReader } from 'omggif';
import { LIMITS } from '@mailmotion/schema';

export interface GifInfo {
  width: number;
  height: number;
  frames: number;
  /** Per-frame delay in ms. */
  delaysMs: number[];
  /** 0 = forever. */
  loopCount: number | null;
  bytes: number;
  /** Peak frame rate implied by the shortest delay. */
  maxFps: number;
  /** Decode frame `i` to RGBA. */
  frame(i: number): Uint8ClampedArray;
}

export function inspectGif(bytes: Uint8Array): GifInfo {
  const reader = new GifReader(bytes as unknown as Buffer);
  const n = reader.numFrames();
  const delaysMs: number[] = [];
  for (let i = 0; i < n; i++) delaysMs.push(reader.frameInfo(i).delay * 10);
  const shortest = Math.min(...delaysMs.filter((d) => d > 0), Infinity);
  return {
    width: reader.width,
    height: reader.height,
    frames: n,
    delaysMs,
    loopCount: reader.loopCount(),
    bytes: bytes.length,
    maxFps: Number.isFinite(shortest) ? 1000 / shortest : 0,
    frame(i: number) {
      const out = new Uint8ClampedArray(reader.width * reader.height * 4);
      reader.decodeAndBlitFrameRGBA(i, out as unknown as Uint8Array);
      return out;
    },
  };
}

export interface GifCheck {
  ok: boolean;
  problems: string[];
}

/** The CI/CLI checks from the plan: <= 300 KB, <= 12 fps. (Frame-1 completeness is asserted by design tests.) */
export function checkGifBudget(bytes: Uint8Array): GifCheck {
  const info = inspectGif(bytes);
  const problems: string[] = [];
  if (info.bytes > LIMITS.gifBytes) problems.push(`${info.bytes} bytes exceeds ${LIMITS.gifBytes}`);
  if (info.frames > 1 && info.maxFps > LIMITS.fps)
    problems.push(`${info.maxFps.toFixed(1)} fps exceeds ${LIMITS.fps}`);
  return { ok: problems.length === 0, problems };
}
