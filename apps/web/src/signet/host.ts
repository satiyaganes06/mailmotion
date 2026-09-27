import {
  DESIGNS,
  INK_FONT,
  renderGif,
  slotKey,
  type MakeCanvas,
  type SignetData,
  type SignetDesign,
} from '@mailmotion/signet';
import { createHttpAdapter, sha256Hex, verifyPublicUrls } from '@mailmotion/storage';
import { autoUploadConfigured, env } from '@/lib/env';
import type { RenderRequest, RenderResponse } from './render.worker';

/**
 * Simple Style hosting: nothing is uploaded while you browse or edit. Copying a design renders
 * that one design's GIF (in a worker) and uploads it to this deployment's storage server — the
 * same one Custom Style uses. Each upload is keyed by `slotKey`, i.e. only the inputs that design
 * draws, so copying it again, or copying after changing something it doesn't show, re-uses it.
 */

/** slotKey → public URL of the uploaded GIF. */
export type Hosted = Record<string, string>;

export type HostProgress =
  | { phase: 'render' | 'upload'; index: number; total: number; name: string }
  | { phase: 'verify'; total: number };

export const hostingConfigured = autoUploadConfigured;

/* ------------------------------------------------------------------ rendering */

let worker: Worker | null | undefined;
let nextReq = 1;
const waiting = new Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
    const w = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<RenderResponse>) => {
      const p = waiting.get(e.data.reqId);
      if (!p) return;
      waiting.delete(e.data.reqId);
      if (e.data.ok) p.resolve(e.data.bytes);
      else p.reject(new Error(e.data.error));
    };
    w.onerror = () => {
      // the worker could not start or crashed: render on the main thread from now on
      worker = null;
      for (const p of waiting.values()) p.reject(new Error('worker failed'));
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

const makeCanvas: MakeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

async function renderOnPage(design: SignetDesign, d: SignetData, accent: string) {
  if (design.id === 'ink') await document.fonts.load(INK_FONT, d.name || 'Aa');
  await new Promise<void>((r) => setTimeout(r, 0)); // let the "Preparing" state paint first
  return renderGif(design.id, d, accent, makeCanvas).bytes;
}

async function render(design: SignetDesign, d: SignetData, accent: string): Promise<Uint8Array> {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const reqId = nextReq++;
        waiting.set(reqId, { resolve, reject });
        const msg: RenderRequest = { reqId, id: design.id, d, accent };
        w.postMessage(msg);
      });
    } catch {
      /* fall through to the page */
    }
  }
  return renderOnPage(design, d, accent);
}

/** Only rendered, never uploaded: the bytes wait until the design is actually copied. */
const renders = new Map<string, Promise<Uint8Array>>();
/** Uploads in flight or done this session (so double-clicks never upload twice). */
const uploads = new Map<string, Promise<string>>();

function renderCached(design: SignetDesign, d: SignetData, accent: string) {
  const key = slotKey(design.id, d, accent);
  let p = renders.get(key);
  if (!p) {
    p = render(design, d, accent);
    p.catch(() => renders.delete(key));
    renders.set(key, p);
    // keep the cache to recent renders
    if (renders.size > 24) renders.delete(renders.keys().next().value!);
  }
  return p;
}

/**
 * Start rendering a design's GIF in the background (e.g. on hover) so a later copy only waits for
 * the upload. Does nothing on browsers without a render worker, to keep the page responsive.
 */
export function warm(design: SignetDesign, d: SignetData, accent: string, hosted: Hosted) {
  if (!hostingConfigured || hosted[slotKey(design.id, d, accent)] || !getWorker()) return;
  void renderCached(design, d, accent).catch(() => {});
}

/* ------------------------------------------------------------------ uploading */

function adapter() {
  if (!hostingConfigured)
    throw new Error(
      'No image storage is configured for this site (NEXT_PUBLIC_UPLOAD_ENDPOINT / NEXT_PUBLIC_UPLOAD_TOKEN).',
    );
  return createHttpAdapter({ endpoint: env.uploadEndpoint, token: env.uploadToken });
}

async function upload(bytes: Uint8Array): Promise<string> {
  const stored = await adapter().put({
    name: `${await sha256Hex(bytes)}.gif`,
    bytes,
    contentType: 'image/gif',
  });
  const [check] = await verifyPublicUrls([stored.url]);
  if (!check?.ok)
    throw new Error(
      `Uploaded, but the image did not load back (${check?.error ?? 'unknown error'}). Check MM_PUBLIC_BASE_URL on the storage server.`,
    );
  return stored.url;
}

/** Public URL of this design's GIF for these details, rendering and uploading it if needed. */
export function ensureHosted(
  design: SignetDesign,
  d: SignetData,
  accent: string,
  hosted: Hosted,
): Promise<string> {
  const key = slotKey(design.id, d, accent);
  if (hosted[key]) return Promise.resolve(hosted[key]!);
  let p = uploads.get(key);
  if (!p) {
    p = renderCached(design, d, accent).then(upload);
    p.catch(() => uploads.delete(key));
    uploads.set(key, p);
  }
  return p;
}

/** Designs whose current GIF (for these details and accent) is not uploaded yet. */
export function missing(d: SignetData, accent: string, hosted: Hosted) {
  return DESIGNS.filter((x) => !hosted[slotKey(x.id, d, accent)]);
}

/** Optional bulk path ("Upload all 10"): every design not yet hosted, one after another. */
export async function hostImages(
  d: SignetData,
  accent: string,
  hosted: Hosted,
  onProgress: (p: HostProgress) => void,
): Promise<Hosted> {
  adapter(); // fail fast when hosting isn't configured
  const todo = missing(d, accent, hosted);
  const next: Hosted = { ...hosted };
  for (let i = 0; i < todo.length; i++) {
    const design = todo[i]!;
    onProgress({ phase: 'render', index: i, total: todo.length, name: design.name });
    next[slotKey(design.id, d, accent)] = await ensureHosted(design, d, accent, next);
  }
  return next;
}
