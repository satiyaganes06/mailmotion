/** Hard limits every signature must respect (see plan §3.3, §4.2). */
export const LIMITS = {
  /** Gmail signature limit, in characters of HTML. */
  htmlChars: 10_000,
  /** Point at which the builder starts warning. */
  htmlWarnChars: 8_500,
  /** Max bytes per GIF. */
  gifBytes: 300 * 1024,
  /** Max frames per second (GIF delays are quantised to 1/100s). */
  fps: 12,
  /** Mobile-safe main block width in px. */
  mainWidth: 400,
  /** "Wide" main block width in px. */
  wideWidth: 600,
  /** Full-width strip (banner) max width in px. */
  stripWidth: 460,
  /** Minimum font size in px (iOS Mail enlarges anything smaller). */
  minFontPx: 12,
  /** Minimum tap target height for social icons, px. */
  minTapPx: 32,
  /** Recommended max social icons. */
  recommendedSocials: 7,
  /** WCAG AA contrast for normal text. */
  contrastText: 4.5,
  /** Contrast floor we require on dark backgrounds (UI/large text threshold). */
  contrastDark: 3,
  /** Max data-URL image size stored inside a portable config, chars. */
  imageDataUrlChars: 600_000,
} as const;

// Matches the six shipped designs' reference sizes (aurora 88, portrait 76, editorial 56,
// wave 72, neon 64, equalizer 68) as closely as a 3-tier scale can (±4px each).
export const AVATAR_SIZES = { S: 60, M: 72, L: 88 } as const;
export const MARK_SIZES = {
  S: { w: 118, h: 29 },
  M: { w: 150, h: 37 },
  L: { w: 220, h: 54 },
} as const;
export const ICON_SIZES = [16, 20, 24, 32] as const;
