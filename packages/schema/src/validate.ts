/** Small, dependency-free validators shared by schema, serializer and builder. */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(v: string): boolean {
  return HEX.test(v);
}

/** `#abc` -> `#aabbcc`, lower-cased. Throws on invalid input. */
export function normalizeHex(v: string): string {
  if (!HEX.test(v)) throw new Error(`Invalid hex colour: ${v}`);
  let h = v.slice(1).toLowerCase();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return `#${h}`;
}

/** Only `https:` URLs (no credentials) are allowed for links. Returns the normalised href or null. */
export function toHttpsUrl(input: string): string | null {
  const s = input.trim();
  if (!s || s.length > 2048 || /[\x00-\x1f\x7f\s]/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (!u.hostname.includes('.')) return null;
  return u.href;
}

export function isHttpsUrl(input: string): boolean {
  return toHttpsUrl(input) !== null;
}

/** Normalise a phone number to E.164 (`+` and 7-15 digits) or return null. */
export function toE164(input: string): string | null {
  const s = input.trim();
  if (!s.startsWith('+')) return null; // an unambiguous international number is required for tel: links
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Basic email check; stricter than the HTML spec on purpose (no quotes, no IP literals). */
export function isEmail(v: string): boolean {
  return /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v) && v.length <= 254;
}

/** Allowed image data URL shapes (no SVG: it can carry script). */
export const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
