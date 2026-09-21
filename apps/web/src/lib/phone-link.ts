import { lintHtml } from '@mailmotion/serializer';

/**
 * "Send to my phone": mobile mail apps cannot paste HTML from a desktop, so the desktop builder
 * makes a private link. The signature travels in the URL *fragment* (`#d=...`), which browsers
 * never send to any server, so this works on the static hosted site with no backend. When the
 * user runs their own storage server, a short `?api=&t=` link is used instead.
 */
export const PHONE_TTL_MS = 24 * 60 * 60 * 1000;

interface Payload {
  v: 1;
  /** signature HTML */
  h: string;
  /** expiry, ms epoch */
  e: number;
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodePhonePayload(
  html: string,
  now = Date.now(),
  ttl = PHONE_TTL_MS,
): Promise<string> {
  const json = new TextEncoder().encode(
    JSON.stringify({ v: 1, h: html, e: now + ttl } satisfies Payload),
  );
  return b64url(await pipe(json, new CompressionStream('deflate-raw')));
}

export type DecodeResult =
  | { ok: true; html: string; expiresAt: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'unsafe' };

export async function decodePhonePayload(encoded: string, now = Date.now()): Promise<DecodeResult> {
  let payload: Payload;
  try {
    const bytes = await pipe(fromB64url(encoded), new DecompressionStream('deflate-raw'));
    payload = JSON.parse(new TextDecoder().decode(bytes)) as Payload;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (payload?.v !== 1 || typeof payload.h !== 'string' || typeof payload.e !== 'number')
    return { ok: false, reason: 'invalid' };
  if (payload.e <= now) return { ok: false, reason: 'expired' };
  return checkHtml(payload.h, payload.e);
}

/** The page renders this HTML, so only markup our serializer could have produced is accepted. */
export function checkHtml(html: string, expiresAt: number): DecodeResult {
  if (html.length > 64 * 1024 || lintHtml(html).length > 0) return { ok: false, reason: 'unsafe' };
  return { ok: true, html, expiresAt };
}

/** QR codes hold ~2.9 KB at the lowest error correction; longer links are copy-only. */
export const QR_MAX_CHARS = 2200;

export function phoneUrl(origin: string, encoded: string): string {
  return `${origin}/phone/#d=${encoded}`;
}

export function phoneServerUrl(origin: string, api: string, token: string): string {
  return `${origin}/phone/?api=${encodeURIComponent(api)}&t=${encodeURIComponent(token)}`;
}

/** Which mail app instructions to show first on this device. */
export function detectPlatform(ua: string): 'ios' | 'android' | 'other' {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
