/// <reference lib="webworker" />
import { renderGif, type MakeCanvas, type SignetData, type SignetId } from '@mailmotion/signet';

/**
 * Renders one Simple Style GIF off the main thread (OffscreenCanvas), so building a big loop
 * like Wave never freezes the page.
 */

export interface RenderRequest {
  reqId: number;
  id: SignetId;
  d: SignetData;
  accent: string;
}
export type RenderResponse =
  { reqId: number; ok: true; bytes: Uint8Array } | { reqId: number; ok: false; error: string };

const make: MakeCanvas = (w, h) => new OffscreenCanvas(w, h) as never;

// The ink design draws in Caveat 600; workers do not see the page's @font-face, so load it here.
let caveat: Promise<void> | null = null;
function loadCaveat(): Promise<void> {
  caveat ??= (async () => {
    const face = new FontFace('Caveat', 'url(/fonts/Caveat.ttf)', { weight: '600' });
    await face.load();
    (self as unknown as { fonts: FontFaceSet }).fonts.add(face);
  })().catch(() => {
    /* fall back to the cursive system fonts listed after Caveat */
  });
  return caveat;
}

self.onmessage = async (e: MessageEvent<RenderRequest>) => {
  const { reqId, id, d, accent } = e.data;
  try {
    if (id === 'ink') await loadCaveat();
    const { bytes } = renderGif(id, d, accent, make);
    const msg: RenderResponse = { reqId, ok: true, bytes };
    (self as unknown as Worker).postMessage(msg, [bytes.buffer]);
  } catch (err) {
    const msg: RenderResponse = {
      reqId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(msg);
  }
};
