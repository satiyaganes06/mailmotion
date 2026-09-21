import type { SignatureAssets } from '@mailmotion/layouts';
import type { RenderedAsset } from '@mailmotion/renderer';
import { createHttpAdapter, toHttpsUrlOrNull } from './storage-shim';

export type HostVia = 'github' | 'server' | 'manual';

/** Where the current signature's images are publicly available. */
export interface Hosted {
  via: HostVia;
  /** content-hashed file name -> public https URL */
  fileUrls: Record<string, string>;
  label?: string;
  at: number;
}

/**
 * Map rendered slots to hosted URLs. Returns null if any needed file is not hosted yet, so the
 * builder never offers a copy of HTML that points at missing images.
 */
export function assetsFromHosted(
  rendered: RenderedAsset[],
  hosted: Hosted | null,
): SignatureAssets | null {
  if (!hosted || rendered.length === 0) return null;
  const slots: SignatureAssets['slots'] = {};
  for (const r of rendered) {
    const url = hosted.fileUrls[r.fileName];
    if (!url) return null;
    slots[r.slotId] = { url, width: r.width, height: r.height };
  }
  return { slots };
}

/** Files that still need hosting for `hosted` to cover `rendered`. */
export function missingFiles(rendered: RenderedAsset[], hosted: Hosted | null): string[] {
  const need = new Set(rendered.map((r) => r.fileName));
  return [...need].filter((n) => !hosted?.fileUrls[n]);
}

/** Manual hosting (ZIP path): the user uploaded the files to `baseUrl` themselves. */
export function hostedFromBaseUrl(
  rendered: RenderedAsset[],
  baseUrl: string,
  now = Date.now(),
): { ok: true; hosted: Hosted } | { ok: false; error: string } {
  const href = toHttpsUrlOrNull(baseUrl);
  if (!href)
    return {
      ok: false,
      error: 'Enter an https:// address (for example https://example.com/signature).',
    };
  const base = href.replace(/\/+$/, '');
  const fileUrls: Record<string, string> = {};
  for (const r of rendered) fileUrls[r.fileName] = `${base}/${r.fileName}`;
  return { ok: true, hosted: { via: 'manual', fileUrls, label: base, at: now } };
}

export interface ServerSettings {
  endpoint: string;
  token: string;
}

/** Upload every unique file to the user's storage server (Path A). */
export async function publishToServer(
  rendered: RenderedAsset[],
  s: ServerSettings,
  onProgress?: (done: number, total: number) => void,
  fetchFn?: typeof fetch,
): Promise<Hosted> {
  const endpoint = s.endpoint.trim();
  if (!/^https?:\/\//i.test(endpoint))
    throw new Error(
      'Enter the address of your storage server, for example https://img.example.com.',
    );
  const adapter = createHttpAdapter({ endpoint, token: s.token.trim(), fetch: fetchFn });
  const files = new Map<string, RenderedAsset>();
  for (const r of rendered) if (!files.has(r.fileName)) files.set(r.fileName, r);
  const fileUrls: Record<string, string> = {};
  let done = 0;
  for (const [name, r] of files) {
    const stored = await adapter.put({
      name,
      bytes: r.bytes,
      contentType: r.format === 'gif' ? 'image/gif' : 'image/png',
    });
    // The server stores under the hash of the sanitized file; that may differ from ours for PNGs.
    fileUrls[name] = stored.url;
    onProgress?.(++done, files.size);
  }
  return { via: 'server', fileUrls, label: endpoint, at: Date.now() };
}
