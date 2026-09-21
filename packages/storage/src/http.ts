import type { StorageAdapter, StoredFile, UploadFile } from './types';

export interface HttpAdapterOptions {
  /** Storage-server base URL, e.g. `http://localhost:8787`. */
  endpoint: string;
  /** The shared `MM_UPLOAD_TOKEN`. */
  token: string;
  /** Where files are publicly served (used for `exists`). Defaults to `endpoint`. */
  publicBaseUrl?: string;
  fetch?: typeof fetch;
}

/** Client for `apps/storage-server`: Path A from the builder. */
export function createHttpAdapter(opts: HttpAdapterOptions): StorageAdapter {
  const endpoint = opts.endpoint.replace(/\/+$/, '');
  const pub = (opts.publicBaseUrl ?? opts.endpoint).replace(/\/+$/, '');
  const f = opts.fetch ?? fetch;
  return {
    kind: 'http',
    async put(file: UploadFile): Promise<StoredFile> {
      const res = await f(`${endpoint}/upload`, {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.token}`, 'content-type': file.contentType },
        body: file.bytes as unknown as BodyInit,
      });
      if (res.status === 401) throw new Error('Upload token was rejected');
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${msg.slice(0, 200)}`);
      }
      const body = (await res.json()) as StoredFile;
      return { name: body.name, url: body.url, bytes: body.bytes };
    },
    async exists(name: string): Promise<boolean> {
      const res = await f(`${pub}/${name}`, { method: 'HEAD' });
      return res.ok;
    },
  };
}
