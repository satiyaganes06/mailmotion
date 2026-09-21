import { isEmail, toE164, toHttpsUrl } from '@mailmotion/schema';
import type { AssetRef } from '@mailmotion/layouts';

/** HTML-escape text for use in element content or a double-quoted attribute. */
export function esc(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape and turn newlines into `<br />`. */
export function escMultiline(input: string): string {
  return input
    .split(/\r?\n/)
    .map((l) => esc(l))
    .join('<br />');
}

/** Only https links survive; anything else is dropped (returns null). */
export function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  const href = toHttpsUrl(url);
  return href ? esc(href) : null;
}

export function mailtoHref(email: string | undefined): string | null {
  if (!email || !isEmail(email)) return null;
  return `mailto:${esc(email)}`;
}

export function telHref(number: string): string | null {
  const e164 = toE164(number);
  return e164 ? `tel:${e164}` : null;
}

/** Image URLs must be https (plus http://localhost / blob: only via `allowLocalPreview`). */
export function safeImageSrc(url: string, allowLocalPreview: boolean): string | null {
  const https = toHttpsUrl(url);
  if (https) return esc(https);
  if (
    allowLocalPreview &&
    (/^blob:/i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url))
  ) {
    return esc(url);
  }
  return null;
}

export function style(props: Record<string, string | number | undefined | false | null>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false || v === null || v === '') continue;
    out.push(`${k}:${v}`);
  }
  return out.join(';');
}

export function attrs(map: Record<string, string | number | undefined | false | null>): string {
  let out = '';
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === false || v === null || v === '') continue;
    out += ` ${k}="${typeof v === 'number' ? v : v}"`;
  }
  return out;
}

export interface ImgOptions {
  alt: string;
  /** Let the image shrink on narrow screens (banner strips). */
  fluid?: boolean;
  allowLocalPreview: boolean;
  extraStyle?: string;
}

export function img(ref: AssetRef, o: ImgOptions): string {
  const src = safeImageSrc(ref.url, o.allowLocalPreview);
  if (!src) return '';
  const st = o.fluid
    ? `display:block;border:0;width:100%;max-width:${ref.width}px;height:auto`
    : 'display:block;border:0';
  return `<img src="${src}" width="${ref.width}" height="${ref.height}" alt="${esc(o.alt)}" style="${st}${o.extraStyle ? ';' + o.extraStyle : ''}" />`;
}

export function link(href: string | null, inner: string, st = ''): string {
  if (!inner) return '';
  if (!href) return inner;
  return st ? `<a href="${href}" style="${st}">${inner}</a>` : `<a href="${href}">${inner}</a>`;
}

export const TABLE_ATTRS = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';
