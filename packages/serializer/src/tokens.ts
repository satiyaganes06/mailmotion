import { DARK_BG, LIGHT_BG, ensureContrast, linkColor } from '@mailmotion/contrast';
import { getLayoutSpec, mainWidth } from '@mailmotion/layouts';
import { LIMITS, type FontFamilyId, type SignatureConfig } from '@mailmotion/schema';

export const FONT_STACKS: Record<FontFamilyId, string> = {
  arial: 'Arial,Helvetica,sans-serif',
  georgia: "Georgia,'Times New Roman',serif",
  verdana: 'Verdana,Geneva,sans-serif',
  tahoma: 'Tahoma,Geneva,sans-serif',
  trebuchet: "'Trebuchet MS',Helvetica,sans-serif",
  times: "'Times New Roman',Times,serif",
};

export interface Tokens {
  font: string;
  nameSize: number;
  bodySize: number;
  smallSize: number;
  nameWeight: 'bold' | 'normal';
  letterSpacing: string;
  lineHeightFactor: number;
  /** Background the text sits on (for contrast maths). */
  surface: string;
  /** null when the background is transparent. */
  bg: string | null;
  colors: {
    name: string;
    title: string;
    body: string;
    muted: string;
    link: string;
    accent: string;
    secondary: string;
    rule: string;
  };
  gap: { row: number; block: number };
  align: 'left' | 'center';
  width: number;
  dark: boolean;
  padding: number;
}

const LETTER_SPACING = { tight: '-0.2px', normal: '0', wide: '0.6px' } as const;
const LINE_HEIGHT = { compact: 1.3, normal: 1.5, relaxed: 1.7 } as const;
const GAPS = {
  compact: { row: 1, block: 6 },
  normal: { row: 2, block: 10 },
  airy: { row: 4, block: 16 },
} as const;

export function buildTokens(cfg: SignatureConfig): Tokens {
  const { theme, typography, extras } = cfg;
  const dark = theme.darkMode === 'force-dark-variant';
  const bg =
    theme.background === 'transparent'
      ? null
      : theme.background === 'white'
        ? '#ffffff'
        : theme.background.color;
  const surface = dark ? (bg ?? DARK_BG) : (bg ?? LIGHT_BG);

  const fix = (c: string) => ensureContrast(c, surface, LIMITS.contrastText);

  const colors = dark
    ? {
        name: fix('#f4f4f5'),
        title: fix('#d4d4d8'),
        body: fix('#d4d4d8'),
        muted: fix('#a1a1aa'),
        link: ensureContrast(theme.accent, surface, LIMITS.contrastText),
        accent: theme.accent,
        secondary: theme.secondary ?? theme.accent,
        rule: '#52525b',
      }
    : {
        name: fix(theme.textColors.name),
        title: fix(theme.textColors.title),
        body: fix(theme.textColors.body),
        muted: fix('#78716c'),
        link: bg
          ? ensureContrast(linkColor(theme.accent), surface, LIMITS.contrastText)
          : linkColor(theme.accent),
        accent: theme.accent,
        secondary: theme.secondary ?? theme.accent,
        rule: '#d6d3d1',
      };

  const spec = getLayoutSpec(cfg.layout.id);
  const align = spec.alignable ? extras.alignment : 'left';

  return {
    font: FONT_STACKS[typography.fontFamily],
    nameSize: typography.nameSize,
    bodySize: Math.max(typography.bodySize, LIMITS.minFontPx),
    smallSize: LIMITS.minFontPx,
    nameWeight: typography.nameWeight === 'bold' ? 'bold' : 'normal',
    letterSpacing: LETTER_SPACING[typography.letterSpacing],
    lineHeightFactor: LINE_HEIGHT[typography.lineHeight],
    surface,
    bg,
    colors,
    gap: GAPS[extras.spacing],
    align,
    width: mainWidth(cfg),
    dark,
    padding: bg ? 12 : 0,
  };
}

export function lineHeightPx(t: Tokens, size: number): number {
  return Math.round(size * t.lineHeightFactor);
}
