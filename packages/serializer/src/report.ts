import { contrastRatio, ensureContrast, LIGHT_BG, DARK_BG } from '@mailmotion/contrast';
import { LIMITS, resolveVariant, type SignatureConfig } from '@mailmotion/schema';
import { serializeWithPlaceholders } from './serialize';

/** Below this, an accent is genuinely hard to see on dark backgrounds (we auto-lighten links anyway). */
const DARK_WARN = 2;

export type CharStatus = 'ok' | 'warn' | 'over';

export interface ContrastIssue {
  /** Which colour the issue is about. */
  field: 'accent' | 'name' | 'title' | 'body' | 'cta' | 'ink';
  chosen: string;
  /** A colour that meets 4.5:1 on light backgrounds (one-click "Use the suggested colour"). */
  suggested: string;
  lightRatio: number;
  darkRatio: number;
  /** `light` = fails on the signature's own background; `dark` = weak in dark mode. */
  problem: 'light' | 'dark';
}

export interface Fix {
  id: string;
  label: string;
  apply: (c: SignatureConfig) => SignatureConfig;
}

export interface Analysis {
  chars: number;
  charStatus: CharStatus;
  /** Gmail export is blocked while the signature is over the limit. */
  canExportGmail: boolean;
  socialCount: number;
  warnings: string[];
  contrast: ContrastIssue[];
  fixes: Fix[];
}

export function charStatus(chars: number): CharStatus {
  if (chars > LIMITS.htmlChars) return 'over';
  if (chars >= LIMITS.htmlWarnChars) return 'warn';
  return 'ok';
}

const clone = (c: SignatureConfig): SignatureConfig => structuredClone(c);

/** Ordered from least to most destructive. */
export const FIXES: Fix[] = [
  {
    id: 'text-links',
    label: 'Use text links instead of social icons',
    apply: (c) => {
      const n = clone(c);
      n.socials.textLinks = true;
      return n;
    },
  },
  {
    id: 'drop-green-note',
    label: 'Remove the environment note',
    apply: (c) => {
      const n = clone(c);
      n.extras.greenNote = false;
      return n;
    },
  },
  {
    id: 'drop-badges',
    label: 'Remove badges',
    apply: (c) => {
      const n = clone(c);
      n.extras.badges = [];
      return n;
    },
  },
  {
    id: 'shorten-disclaimer',
    label: 'Shorten the disclaimer',
    apply: (c) => {
      const n = clone(c);
      if (n.extras.disclaimer && n.extras.disclaimer.length > 200) {
        n.extras.disclaimer = n.extras.disclaimer.slice(0, 197).trimEnd() + '...';
      }
      return n;
    },
  },
  {
    id: 'trim-socials',
    label: 'Keep only the first 5 social links',
    apply: (c) => {
      const n = clone(c);
      n.socials.items = n.socials.items.slice(0, 5);
      return n;
    },
  },
  {
    id: 'drop-logo',
    label: 'Remove the company logo',
    apply: (c) => {
      const n = clone(c);
      n.extras.logo.enabled = false;
      return n;
    },
  },
  {
    id: 'drop-disclaimer',
    label: 'Remove the disclaimer',
    apply: (c) => {
      const n = clone(c);
      n.extras.disclaimer = undefined;
      return n;
    },
  },
  {
    id: 'drop-custom',
    label: 'Remove custom fields and tagline',
    apply: (c) => {
      const n = clone(c);
      n.details.customFields = [];
      n.details.tagline = undefined;
      return n;
    },
  },
  {
    id: 'drop-cta',
    label: 'Remove the call-to-action button',
    apply: (c) => {
      const n = clone(c);
      n.extras.cta.enabled = false;
      return n;
    },
  },
  {
    id: 'drop-address',
    label: 'Remove the address and department',
    apply: (c) => {
      const n = clone(c);
      n.details.address = undefined;
      n.details.department = undefined;
      return n;
    },
  },
  {
    id: 'drop-socials',
    label: 'Remove social links',
    apply: (c) => {
      const n = clone(c);
      n.socials.items = [];
      return n;
    },
  },
];

const measure = (c: SignatureConfig, baseUrl?: string) =>
  serializeWithPlaceholders(c, baseUrl).chars;

/**
 * Apply fixes in order until the signature fits in Gmail's limit.
 * Returns the (possibly unchanged) config and which fixes were used.
 */
export function fitBudget(
  config: SignatureConfig,
  opts: { baseUrl?: string; limit?: number } = {},
): { config: SignatureConfig; applied: string[]; fits: boolean; chars: number } {
  const limit = opts.limit ?? LIMITS.htmlChars;
  let cur = config;
  let chars = measure(cur, opts.baseUrl);
  const applied: string[] = [];
  for (const fix of FIXES) {
    if (chars <= limit) break;
    const next = fix.apply(cur);
    const nextChars = measure(next, opts.baseUrl);
    if (nextChars < chars) {
      cur = next;
      chars = nextChars;
      applied.push(fix.id);
    }
  }
  return { config: cur, applied, fits: chars <= limit, chars };
}

/** Colours the user picked that fail on light backgrounds, or read poorly in dark mode. */
export function contrastIssues(config: SignatureConfig): ContrastIssue[] {
  const cfg = resolveVariant(config);
  const t = cfg.theme;
  const bg =
    t.background === 'transparent'
      ? LIGHT_BG
      : t.background === 'white'
        ? LIGHT_BG
        : t.background.color;
  const out: ContrastIssue[] = [];

  const consider = (
    field: ContrastIssue['field'],
    chosen: string,
    onBg: string,
    darkCheck: boolean,
  ) => {
    const light = contrastRatio(chosen, onBg);
    const dark = contrastRatio(chosen, DARK_BG);
    if (light < LIMITS.contrastText) {
      out.push({
        field,
        chosen,
        suggested: ensureContrast(chosen, onBg, LIMITS.contrastText),
        lightRatio: light,
        darkRatio: dark,
        problem: 'light',
      });
    } else if (darkCheck && dark < DARK_WARN) {
      out.push({
        field,
        chosen,
        suggested: ensureContrast(chosen, bg, LIMITS.contrastText),
        lightRatio: light,
        darkRatio: dark,
        problem: 'dark',
      });
    }
  };

  consider('accent', t.accent, bg, true);
  consider('name', t.textColors.name, bg, false);
  consider('title', t.textColors.title, bg, false);
  consider('body', t.textColors.body, bg, false);
  const cta = cfg.extras.cta;
  if (cta.enabled) consider('cta', cta.color, cta.background ?? t.accent, false);
  return out;
}

/** Everything the builder's meters and warnings need. */
export function analyzeSignature(config: SignatureConfig, baseUrl?: string): Analysis {
  const cfg = resolveVariant(config);
  const chars = measure(config, baseUrl);
  const status = charStatus(chars);
  const warnings: string[] = [];
  if (status === 'warn')
    warnings.push(
      `Signature is ${chars.toLocaleString('en-US')} of ${LIMITS.htmlChars.toLocaleString('en-US')} characters. Gmail truncates beyond the limit.`,
    );
  if (status === 'over')
    warnings.push(
      `Signature is over Gmail's ${LIMITS.htmlChars.toLocaleString('en-US')}-character limit (${chars.toLocaleString('en-US')}). Gmail export is blocked until it fits.`,
    );

  const socialCount = cfg.layout.sections.social ? cfg.socials.items.length : 0;
  if (socialCount > LIMITS.recommendedSocials) {
    warnings.push(
      `${socialCount} social icons is a lot. More than ${LIMITS.recommendedSocials} may wrap on phones and uses character budget.`,
    );
  }
  if (cfg.layout.width === 'wide')
    warnings.push('Wide layout (600px) may not fit narrow phone screens.');

  const fixes =
    status === 'ok' ? [] : FIXES.filter((f) => measure(f.apply(config), baseUrl) < chars);
  return {
    chars,
    charStatus: status,
    canExportGmail: chars <= LIMITS.htmlChars,
    socialCount,
    warnings,
    contrast: contrastIssues(config),
    fixes,
  };
}
