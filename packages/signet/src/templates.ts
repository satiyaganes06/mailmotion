/**
 * Simple Style: the ten Signet signature designs, transcribed line for line from the Signet
 * reference page (test/fixtures/signet-reference.html). Every template below must produce the
 * exact same HTML as the reference for the same input — test/templates.test.ts evaluates the
 * reference's own script and compares output byte for byte.
 *
 * Nothing here is shared with Custom Style's serializer/layouts; the only thing the two styles
 * share is how rendered images get hosted.
 */

export interface SignetData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  tagline: string;
  status: string;
}

export type SignetId =
  | 'aurora'
  | 'pulse'
  | 'typewriter'
  | 'wave'
  | 'neon'
  | 'shimmer'
  | 'orbit'
  | 'ticker'
  | 'equalizer'
  | 'ink';

export interface SignetDesign {
  id: SignetId;
  name: string;
  use: string;
  /** Display size of the animated slot (the GIF), in CSS pixels. */
  w: number;
  h: number;
  alt: (d: SignetData) => string;
  /** The live-preview markup for the animated slot (CSS-animated, as on the reference page). */
  anim: (d: SignetData, a: string) => string;
  layout: (d: SignetData, a: string, slot: string) => string;
}

export const DEFAULT_ACCENT = '#2A5DB0';

export const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const initials = (s: string) =>
  String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
export const hostOf = (u: string) =>
  String(u)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
export const hrefOf = (u: string) => (/^https?:\/\//.test(u) ? u : 'https://' + u);
const F = 'font-family:Arial,Helvetica,sans-serif;';
const P = (style: string, inner: string) => `<p style="margin:0;${F}${style}">${inner}</p>`;
const T = (inner: string, extra = '') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${extra} style="border-collapse:collapse;">${inner}</table>`;

function contacts(d: SignetData, color: string, link: string): string {
  const p: string[] = [];
  if (d.phone)
    p.push(
      `<a href="tel:${esc(d.phone.replace(/[^+\d]/g, ''))}" style="color:${color};text-decoration:none;">${esc(d.phone)}</a>`,
    );
  if (d.email)
    p.push(
      `<a href="mailto:${esc(d.email)}" style="color:${link};text-decoration:none;">${esc(d.email)}</a>`,
    );
  if (d.website)
    p.push(
      `<a href="${esc(hrefOf(d.website))}" style="color:${link};text-decoration:none;">${esc(hostOf(d.website))}</a>`,
    );
  return p.join('<span style="color:#b5bccb;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>');
}
const roleLine = (d: SignetData, a: string) =>
  `${esc(d.title)}${d.title && d.company ? ' at ' : ''}<b style="color:${a};">${esc(d.company)}</b>`;
const bar = (a: string, w = 36) =>
  T(
    `<tr><td width="${w}" height="3" bgcolor="${a}" style="font-size:0;line-height:0;background:${a};">&nbsp;</td></tr>`,
  );

export const DESIGNS: SignetDesign[] = [
  {
    id: 'aurora',
    name: 'Aurora ring',
    use: 'A spinning gradient ring around your initials. Works for most roles.',
    w: 88,
    h: 88,
    alt: (d) => `${d.name}`,
    anim: (d, a) =>
      `<span class="a-aurora" style="--acc:${a}"><b>${esc(initials(d.name))}</b></span>`,
    layout: (d, a, slot) =>
      T(
        `<tr><td style="padding:0 16px 0 0;vertical-align:middle;">${slot}</td><td style="border-left:2px solid ${a};padding:2px 0 2px 16px;vertical-align:middle;">${P('font-size:18px;font-weight:bold;color:#16213a;line-height:24px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', roleLine(d, a))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:6px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
  {
    id: 'pulse',
    name: 'Pulse',
    use: 'An availability ping beside your initials. Good for sales, support and consultants.',
    w: 80,
    h: 80,
    alt: (d) => `${d.name}`,
    anim: (d, a) =>
      `<span class="a-pulse" style="--acc:${a}"><b>${esc(initials(d.name))}</b></span>`,
    layout: (d, a, slot) =>
      T(
        `<tr><td style="padding:0 14px 0 0;vertical-align:middle;">${slot}</td><td style="vertical-align:middle;">${P('font-size:17px;font-weight:bold;color:#16213a;line-height:23px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', roleLine(d, a))}${P('font-size:12px;color:#1f7a45;line-height:20px;', `<span style="color:#1f9d55;">&#9679;</span>&nbsp;${esc(d.status)}`)}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:4px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    use: 'Your tagline types itself out. Suits writers, founders and developers.',
    w: 340,
    h: 22,
    alt: (d) => d.tagline,
    anim: (d, a) => {
      const t = typedText(d);
      return `<span class="a-type" style="--acc:${a};--w:${t.length}ch;color:#16213a;animation-timing-function:steps(${Math.max(t.length, 1)},end),step-end;">${esc(t)}</span>`;
    },
    layout: (d, a, slot) =>
      T(
        `<tr><td style="padding:0 0 10px 0;">${bar(a)}</td></tr><tr><td>${P('font-size:20px;font-weight:bold;color:#16213a;line-height:26px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', roleLine(d, a))}</td></tr><tr><td style="padding:8px 0;">${slot}</td></tr><tr><td>${P('font-size:12px;color:#5a6478;line-height:20px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
  {
    id: 'wave',
    name: 'Wave banner',
    use: 'A rolling company banner under your details. Good for brand-led teams.',
    w: 460,
    h: 56,
    alt: (d) => d.company,
    anim: (d, a) => {
      const path = (y: number) =>
        `M0 ${y} Q115 ${y - 18} 230 ${y} T460 ${y} T690 ${y} T920 ${y} V56 H0 Z`;
      return `<span class="a-wave" style="--acc:${a}"><svg class="w1" viewBox="0 0 920 56" width="920" height="56" aria-hidden="true"><path d="${path(36)}" fill="#fff" fill-opacity=".22"/></svg><svg class="w2" viewBox="0 0 920 56" width="920" height="56" aria-hidden="true"><path d="${path(42)}" fill="#fff" fill-opacity=".16"/></svg><b>${esc(d.company)}</b><i>${esc(hostOf(d.website))}</i></span>`;
    },
    layout: (d, a, slot) =>
      T(
        `<tr><td>${P('font-size:17px;font-weight:bold;color:#16213a;line-height:23px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', roleLine(d, a))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:4px;', contacts(d, '#5a6478', a))}</td></tr><tr><td style="padding-top:10px;">${slot}</td></tr>`,
      ),
  },
  {
    id: 'neon',
    name: 'Neon night',
    use: 'A dark card with a flickering neon mark. For gaming, nightlife and creative studios.',
    w: 72,
    h: 72,
    alt: (d) => d.company,
    anim: (d, a) => `<span class="a-neon" style="--acc:${a}">${esc(initials(d.company))}</span>`,
    layout: (d, a, slot) =>
      T(
        `<tr><td style="padding:18px 18px 18px 18px;vertical-align:middle;">${slot}</td><td style="padding:18px 22px 18px 0;vertical-align:middle;">${P('font-size:17px;font-weight:bold;color:#ffffff;line-height:23px;', esc(d.name))}${P('font-size:13px;color:#a9b1c7;line-height:20px;', `${esc(d.title)}${d.title && d.company ? ' at ' : ''}<b style="color:#ffffff;">${esc(d.company)}</b>`)}${P('font-size:12px;color:#a9b1c7;line-height:20px;padding-top:6px;', contacts(d, '#a9b1c7', '#c9d6ff'))}</td></tr>`,
        'bgcolor="#0d1020"',
      ).replace(
        'style="border-collapse:collapse;"',
        'style="border-collapse:separate;background:#0d1020;border-radius:12px;"',
      ),
  },
  {
    id: 'shimmer',
    name: 'Shimmer plate',
    use: 'A company nameplate with a light sweep. Clean and corporate.',
    w: 300,
    h: 44,
    alt: (d) => d.company,
    anim: (d, a) => `<span class="a-shim" style="--acc:${a}">${esc(d.company)}</span>`,
    layout: (d, a, slot) =>
      T(
        `<tr><td>${slot}</td></tr><tr><td style="padding-top:10px;">${P('font-size:16px;font-weight:bold;color:#16213a;line-height:22px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', esc(d.title))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:4px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
  {
    id: 'orbit',
    name: 'Orbit',
    use: 'Two satellites circling your company mark. For tech and product teams.',
    w: 84,
    h: 84,
    alt: (d) => `${d.company} logo`,
    anim: (d, a) =>
      `<span class="a-orbit" style="--acc:${a}"><b>${esc(initials(d.company))}</b><i class="s1"></i><i class="s2"></i></span>`,
    layout: (d, a, slot) =>
      T(
        `<tr><td style="padding:0 16px 0 0;vertical-align:middle;">${slot}</td><td style="vertical-align:middle;">${P(`font-size:12px;font-weight:bold;color:${a};line-height:18px;letter-spacing:.3px;`, esc(d.company))}${P('font-size:18px;font-weight:bold;color:#16213a;line-height:24px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', esc(d.title))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:4px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
  {
    id: 'ticker',
    name: 'News ticker',
    use: 'A scrolling strip for launches, events or hiring news. Change it as often as you like.',
    w: 460,
    h: 28,
    alt: (d) => d.tagline,
    anim: (d, a) => {
      const item = `<em>&#10022;</em>${esc(d.tagline)}<em>&#10022;</em>${esc(hostOf(d.website))}`;
      const half = item.repeat(4);
      return `<span class="a-tick" style="--acc:${a}"><span>${half}${half}</span></span>`;
    },
    layout: (d, a, slot) =>
      T(
        `<tr><td>${P('font-size:17px;font-weight:bold;color:#16213a;line-height:23px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', roleLine(d, a))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:4px;', contacts(d, '#5a6478', a))}</td></tr><tr><td style="padding-top:10px;">${slot}</td></tr>`,
      ),
  },
  {
    id: 'equalizer',
    name: 'Equalizer',
    use: 'Bouncing audio bars. Made for podcasters, musicians and audio brands.',
    w: 64,
    h: 64,
    alt: () => 'Audio bars',
    anim: (d, a) =>
      `<span class="a-eq" style="--acc:${a}">${EQ_BARS.map((h) => `<i style="height:${h}px"></i>`).join('')}</span>`,
    layout: (d, a, slot) =>
      T(
        `<tr><td style="padding:0 14px 0 0;vertical-align:top;">${slot}</td><td style="vertical-align:top;">${P('font-size:17px;font-weight:bold;color:#16213a;line-height:23px;', esc(d.name))}${P('font-size:13px;color:#5a6478;line-height:20px;', roleLine(d, a))}${P('font-size:13px;font-style:italic;color:#16213a;line-height:20px;', esc(d.tagline))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:4px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
  {
    id: 'ink',
    name: 'Ink signature',
    use: 'Your name written by hand, stroke by stroke. For lawyers, artists and personal brands.',
    w: 260,
    h: 64,
    alt: (d) => d.name,
    anim: (d, a) => {
      const long = inkIsLong(d) ? ' textLength="248" lengthAdjust="spacingAndGlyphs"' : '';
      return `<svg class="a-ink" viewBox="0 0 260 64" width="260" height="64" role="img" aria-label="${esc(d.name)}"><text x="4" y="48" font-size="46" fill="${a}" stroke="${a}" stroke-width="1.2"${long}>${esc(d.name)}</text></svg>`;
    },
    layout: (d, a, slot) =>
      T(
        `<tr><td>${slot}</td></tr><tr><td style="padding:6px 0 8px 0;">${bar(a, 48)}</td></tr><tr><td>${P('font-size:13px;color:#16213a;line-height:20px;', roleLine(d, a))}${P('font-size:12px;color:#5a6478;line-height:20px;padding-top:2px;', contacts(d, '#5a6478', a))}</td></tr>`,
      ),
  },
];

/** Bar heights (px) of the Equalizer slot, as on the reference page. */
export const EQ_BARS = [18, 30, 38, 24, 32] as const;

/** The typewriter only ever types the first 42 characters of the tagline. */
export const typedText = (d: SignetData) => String(d.tagline).slice(0, 42);
/** Long names are squeezed into 248px on the ink design. */
export const inkIsLong = (d: SignetData) => String(d.name).length > 15;

export function getDesign(id: SignetId): SignetDesign {
  return DESIGNS.find((x) => x.id === id)!;
}

/** Trim every field and fall back to the default accent, exactly like the reference's `data()`. */
export function normalize(
  raw: Partial<SignetData> & { accent?: string },
): SignetData & { accent: string } {
  const pick = (k: keyof SignetData) => String(raw[k] ?? '').trim();
  const accent = String(raw.accent ?? '').trim();
  return {
    name: pick('name'),
    title: pick('title'),
    company: pick('company'),
    phone: pick('phone'),
    email: pick('email'),
    website: pick('website'),
    tagline: pick('tagline'),
    status: pick('status'),
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : DEFAULT_ACCENT,
  };
}

/** The live preview: the layout with the CSS-animated slot (`.anim` span) in the GIF's place. */
export function previewHtml(design: SignetDesign, d: SignetData, a: string): string {
  const slot = `<span class="anim" style="width:${design.w}px;height:${design.h}px">${design.anim(d, a)}</span>`;
  return design.layout(d, a, slot);
}

/** The signature to paste into a mail client: the layout with the hosted GIF in the slot. */
export function exportHtml(design: SignetDesign, d: SignetData, a: string, gifUrl: string): string {
  const img = `<img src="${esc(gifUrl)}" width="${design.w}" height="${design.h}" alt="${esc(design.alt(d))}" style="display:block;border:0;outline:none;text-decoration:none;width:${design.w}px;height:${design.h}px;">`;
  return `<!-- Signet: ${design.id} -->\n` + design.layout(d, a, img);
}
