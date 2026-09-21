import { contentTypeForName } from './types';

export interface UrlCheck {
  url: string;
  ok: boolean;
  status?: number;
  contentType?: string | null;
  error?: string;
}

type Fetch = typeof fetch;

/**
 * Health check: does each public URL really serve an image with the right `Content-Type`?
 * (Gmail's image proxy silently drops images that 404 or come back as text/html.)
 */
export async function verifyPublicUrls(
  urls: string[],
  opts: { fetch?: Fetch; timeoutMs?: number } = {},
): Promise<UrlCheck[]> {
  const f = opts.fetch ?? fetch;
  return Promise.all(
    urls.map(async (url): Promise<UrlCheck> => {
      const expected = contentTypeForName(url);
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 10_000);
        const res = await f(url, { method: 'GET', signal: ctl.signal, cache: 'no-store' });
        clearTimeout(timer);
        const ct = res.headers.get('content-type');
        if (!res.ok)
          return {
            url,
            ok: false,
            status: res.status,
            contentType: ct,
            error: `HTTP ${res.status}`,
          };
        if (!ct || !ct.toLowerCase().startsWith(expected)) {
          return {
            url,
            ok: false,
            status: res.status,
            contentType: ct,
            error: `Content-Type is ${ct ?? 'missing'}, expected ${expected}`,
          };
        }
        return { url, ok: true, status: res.status, contentType: ct };
      } catch (e) {
        return { url, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}
