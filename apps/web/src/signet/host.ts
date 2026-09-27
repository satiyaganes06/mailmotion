import {
  DESIGNS,
  INK_FONT,
  renderGif,
  slotKey,
  type MakeCanvas,
  type SignetData,
} from '@mailmotion/signet';
import { createHttpAdapter, sha256Hex, verifyPublicUrls } from '@mailmotion/storage';
import { autoUploadConfigured, env } from '@/lib/env';

/** slotKey → public URL of the uploaded GIF. */
export type Hosted = Record<string, string>;

export type HostProgress =
  | { phase: 'render' | 'upload'; index: number; total: number; name: string }
  | { phase: 'verify'; total: number };

export const hostingConfigured = autoUploadConfigured;
export const hostingEndpoint = env.uploadEndpoint;

const makeCanvas: MakeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Designs whose current GIF (for these details and accent) is not uploaded yet. */
export function missing(d: SignetData, accent: string, hosted: Hosted) {
  return DESIGNS.filter((x) => !hosted[slotKey(x.id, d, accent)]);
}

/**
 * Render every design's animated slot that isn't hosted yet, upload it to this deployment's
 * storage server (the same one Custom Style uploads to), and check each public URL serves a GIF.
 */
export async function hostImages(
  d: SignetData,
  accent: string,
  hosted: Hosted,
  onProgress: (p: HostProgress) => void,
): Promise<Hosted> {
  if (!hostingConfigured)
    throw new Error(
      'No storage bucket is configured for this site (NEXT_PUBLIC_UPLOAD_ENDPOINT / NEXT_PUBLIC_UPLOAD_TOKEN).',
    );
  // the ink design draws with Caveat; Arial and Courier New are system fonts
  await document.fonts.load(INK_FONT, d.name || 'Aa');
  await document.fonts.ready;
  const adapter = createHttpAdapter({ endpoint: env.uploadEndpoint, token: env.uploadToken });
  const todo = missing(d, accent, hosted);
  const next: Hosted = { ...hosted };
  const fresh: string[] = [];
  for (let i = 0; i < todo.length; i++) {
    const design = todo[i]!;
    onProgress({ phase: 'render', index: i, total: todo.length, name: design.name });
    await nextTick(); // let the status line paint before the (synchronous) render
    const gif = renderGif(design.id, d, accent, makeCanvas);
    onProgress({ phase: 'upload', index: i, total: todo.length, name: design.name });
    const stored = await adapter.put({
      name: `${await sha256Hex(gif.bytes)}.gif`,
      bytes: gif.bytes,
      contentType: 'image/gif',
    });
    next[slotKey(design.id, d, accent)] = stored.url;
    fresh.push(stored.url);
  }
  if (fresh.length) {
    onProgress({ phase: 'verify', total: fresh.length });
    const bad = (await verifyPublicUrls(fresh)).filter((c) => !c.ok);
    if (bad.length)
      throw new Error(
        `Uploaded, but ${bad.length} image${bad.length === 1 ? '' : 's'} did not load back (${bad[0]!.error}). Check MM_PUBLIC_BASE_URL on the storage server.`,
      );
  }
  return next;
}
