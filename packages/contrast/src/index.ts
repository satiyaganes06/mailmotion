/**
 * Colour maths for email signatures.
 *
 * A single colour cannot reach 4.5:1 on both white and a typical dark-mode background, so the rule is:
 *   - light backgrounds: >= 4.5:1 (WCAG AA text) — enforced
 *   - dark backgrounds:  >= 3:1  (UI / large-text floor) — enforced for accents, warned for text
 * `accessibleAccent` finds the colour in that window closest to the one the user picked.
 */

export const LIGHT_BG = '#ffffff';
/** Representative dark-mode background (Gmail / Outlook dark surfaces sit around #1e1e1e-#202124). */
export const DARK_BG = '#202124';
export const MIN_LIGHT = 4.5;
export const MIN_DARK = 3;

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex colour: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const lin = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb([h, s, l]: [number, number, number]): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: RGB = [0, 0, 0];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}

export interface ColorCheck {
  light: { ratio: number; pass: boolean };
  dark: { ratio: number; pass: boolean };
  /** Passes on light and dark. */
  ok: boolean;
}

export function checkColor(fg: string, opts: { light?: string; dark?: string } = {}): ColorCheck {
  const lr = contrastRatio(fg, opts.light ?? LIGHT_BG);
  const dr = contrastRatio(fg, opts.dark ?? DARK_BG);
  const light = { ratio: lr, pass: lr >= MIN_LIGHT };
  const dark = { ratio: dr, pass: dr >= MIN_DARK };
  return { light, dark, ok: light.pass && dark.pass };
}

/** Minimally darken (or lighten) `fg` until it reaches `min` contrast against `bg`. */
export function ensureContrast(fg: string, bg: string, min: number = MIN_LIGHT): string {
  if (contrastRatio(fg, bg) >= min) return rgbToHex(hexToRgb(fg));
  const hsl = rgbToHsl(hexToRgb(fg));
  const bgLum = relativeLuminance(bg);
  // Move away from the background: darker on a light bg, lighter on a dark bg.
  const towardDark = bgLum > 0.18;
  const [start, end] = towardDark ? [hsl[2], 0] : [hsl[2], 1];
  let lo = 0,
    hi = 1; // t in [0,1] along start->end
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const l = start + (end - start) * mid;
    const hex = rgbToHex(hslToRgb([hsl[0], hsl[1], l]));
    if (contrastRatio(hex, bg) >= min) hi = mid;
    else lo = mid;
  }
  const l = start + (end - start) * hi;
  const out = rgbToHex(hslToRgb([hsl[0], hsl[1], l]));
  if (contrastRatio(out, bg) >= min) return out;
  return towardDark ? '#000000' : '#ffffff';
}

/** The luminance window where a colour passes on both light (>=4.5) and dark (>=3) backgrounds. */
export function accentWindow(light = LIGHT_BG, dark = DARK_BG): { min: number; max: number } {
  const max = (relativeLuminance(light) + 0.05) / MIN_LIGHT - 0.05;
  const min = MIN_DARK * (relativeLuminance(dark) + 0.05) - 0.05;
  return { min, max };
}

/**
 * Nudge an accent colour (keeping hue and saturation) into the luminance window where it reads on
 * both light and dark backgrounds. Returns the input unchanged if it already passes.
 */
export function accessibleAccent(hex: string): string {
  const win = accentWindow();
  const lum = relativeLuminance(hex);
  if (lum >= win.min && lum <= win.max) return rgbToHex(hexToRgb(hex));
  const [h, s, l0] = rgbToHsl(hexToRgb(hex));
  const margin = 0.004;
  const target = lum > win.max ? win.max - margin : win.min + margin;
  let lo = lum > win.max ? 0 : l0;
  let hi = lum > win.max ? l0 : 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const v = relativeLuminance(rgbToHex(hslToRgb([h, s, mid])));
    if (v < target) lo = mid;
    else hi = mid;
  }
  return rgbToHex(hslToRgb([h, s, (lo + hi) / 2]));
}

/** Link/accent text colour for use on the signature's light background. */
export function linkColor(accent: string): string {
  return accessibleAccent(accent);
}

/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: string): '#000000' | '#ffffff' {
  return contrastRatio('#ffffff', bg) >= contrastRatio('#000000', bg) ? '#ffffff' : '#000000';
}

/** Blend two hex colours; `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a),
    y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
