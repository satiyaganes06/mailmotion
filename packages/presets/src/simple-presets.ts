import {
  createConfig,
  type AvatarAnimationId,
  type BannerKind,
  type FieldKey,
  type LayoutId,
  type SignatureConfig,
  type SignatureConfigInput,
  type SimplePresetId,
} from '@mailmotion/schema';

/**
 * "Simple Style" — a second, separate catalogue of ten designs recreating the Signet demo
 * (see docs/simple-style.md), sharing the same `SignatureConfig` schema and rendering pipeline
 * as Custom Style's six presets in `./presets.ts`, but with a single user-chosen accent colour
 * (no two-tone palette) and a smaller field set (no socials, no banner/CTA/badge editor).
 */
export interface SimplePresetDef {
  id: SimplePresetId;
  name: string;
  layout: LayoutId;
  avatarAnimation?: AvatarAnimationId;
  bestFor: string;
  /** Which of the simple field set this design actually shows (drives the panel, not the schema). */
  fields: {
    company?: boolean;
    phone?: boolean;
    email?: boolean;
    website?: boolean;
    tagline?: boolean;
    status?: boolean;
  };
  patch: {
    avatar?: Partial<SignatureConfig['avatar']>;
    mark: Partial<SignatureConfig['mark']>;
    layoutSections?: Partial<SignatureConfig['layout']['sections']>;
    background?: SignatureConfig['theme']['background'];
    darkMode?: SignatureConfig['theme']['darkMode'];
    banner?: Partial<SignatureConfig['extras']['banner']>;
    taglineStyle?: SignatureConfig['extras']['taglineStyle'];
    fieldOrder?: FieldKey[];
  };
}

/** The default single accent every Simple Style design starts with (matches the source demo). */
export const SIMPLE_DEFAULT_ACCENT = '#2A5DB0';

// None of the ten designs sets `avatar.ring` or `mark.color` explicitly: both fall back to
// `theme.accent` at render time (see packages/renderer's `ringOf`/`renderMark`), which is what
// keeps Simple Style's one colour picker live — change the accent and every design updates,
// with no separate palette step like Custom Style's.
export const SIMPLE_PRESETS: Record<SimplePresetId, SimplePresetDef> = {
  'simple-aurora': {
    id: 'simple-aurora',
    name: 'Aurora ring',
    layout: 'card',
    avatarAnimation: 'aurora',
    bestFor: 'Anyone, professional default',
    fields: { company: true, phone: true, email: true, website: true },
    patch: {
      avatar: { animation: 'aurora', shape: 'circle', size: 'L' },
      mark: { animation: 'ink', position: 'below', size: 'S', glow: false, enabled: true },
    },
  },
  'simple-pulse': {
    id: 'simple-pulse',
    name: 'Pulse',
    layout: 'left-portrait',
    avatarAnimation: 'pulse',
    bestFor: 'Sales, support and consultants',
    fields: { company: true, email: true, status: true },
    patch: {
      avatar: { animation: 'pulse', shape: 'circle', size: 'M' },
      mark: { animation: 'ink', position: 'below', size: 'S', glow: false, enabled: true },
      taglineStyle: 'status',
    },
  },
  'simple-typewriter': {
    id: 'simple-typewriter',
    name: 'Typewriter',
    layout: 'editorial',
    bestFor: 'Writers, founders and developers',
    fields: { tagline: true },
    patch: {
      mark: { enabled: false },
      layoutSections: { avatar: false },
      banner: { enabled: true, kind: 'typewriter' as BannerKind, height: 24 },
    },
  },
  'simple-wave': {
    id: 'simple-wave',
    name: 'Wave banner',
    layout: 'banner',
    bestFor: 'Brand-led teams',
    fields: { company: true, email: true, website: true },
    patch: {
      mark: { enabled: false },
      layoutSections: { avatar: false },
      banner: { enabled: true, kind: 'wave' as BannerKind, height: 56 },
    },
  },
  'simple-neon': {
    id: 'simple-neon',
    name: 'Neon night',
    layout: 'bordered',
    avatarAnimation: 'neon',
    bestFor: 'Gaming, nightlife and creative studios',
    fields: { company: true, email: true },
    patch: {
      avatar: { animation: 'neon', shape: 'rounded', size: 'M' },
      mark: { animation: 'ink', position: 'below', size: 'M', glow: true, enabled: true },
      background: { color: '#0d1020' },
      darkMode: 'force-dark-variant',
    },
  },
  'simple-shimmer': {
    id: 'simple-shimmer',
    name: 'Shimmer plate',
    layout: 'banner-top',
    bestFor: 'Clean, corporate nameplates',
    fields: { company: true, email: true },
    patch: {
      mark: { enabled: false },
      layoutSections: { avatar: false },
      banner: { enabled: true, kind: 'shimmer' as BannerKind, height: 44 },
    },
  },
  'simple-orbit': {
    id: 'simple-orbit',
    name: 'Orbit',
    layout: 'left-portrait',
    avatarAnimation: 'orbit',
    bestFor: 'Tech and product teams',
    fields: { company: true, email: true, website: true },
    patch: {
      avatar: { animation: 'orbit', shape: 'circle', size: 'L' },
      mark: { animation: 'ink', position: 'below', size: 'S', glow: false, enabled: true },
      // The reference shows the company as a small bold eyebrow above the name; our name row is
      // always first (every design relies on it), so the closest match is company right after it.
      fieldOrder: ['company', 'title', 'email', 'websites'],
    },
  },
  'simple-ticker': {
    id: 'simple-ticker',
    name: 'News ticker',
    layout: 'banner',
    bestFor: 'Launches, events or hiring news',
    fields: { company: true, email: true, tagline: true },
    patch: {
      mark: { enabled: false },
      layoutSections: { avatar: false },
      banner: { enabled: true, kind: 'ticker' as BannerKind, height: 28 },
    },
  },
  'simple-equalizer': {
    id: 'simple-equalizer',
    name: 'Equalizer',
    layout: 'left-portrait',
    avatarAnimation: 'equalizer',
    bestFor: 'Podcasters, musicians and audio brands',
    fields: { company: true, email: true, tagline: true },
    patch: {
      avatar: { animation: 'equalizer', shape: 'circle', size: 'M' },
      mark: { enabled: false },
      taglineStyle: 'italic',
    },
  },
  'simple-ink': {
    id: 'simple-ink',
    name: 'Ink signature',
    layout: 'editorial',
    bestFor: 'Lawyers, artists and personal brands',
    fields: { company: true, email: true },
    patch: {
      mark: { animation: 'ink', position: 'above', size: 'L', glow: false, enabled: true },
      layoutSections: { avatar: false },
    },
  },
};

export const SIMPLE_PRESET_LIST = Object.values(SIMPLE_PRESETS);

export function getSimplePreset(id: SimplePresetId): SimplePresetDef {
  return SIMPLE_PRESETS[id];
}

function reparse(c: unknown): SignatureConfig {
  return createConfig(c as SignatureConfigInput);
}

/** Suppress every field the active design doesn't show in the panel — otherwise a field a
 * previous design (or Custom Style) populated would keep rendering even with no input to edit
 * or clear it from (e.g. a tagline left over from Typewriter still showing under Aurora). */
function hiddenForSimple(fields: SimplePresetDef['fields']): FieldKey[] {
  const hidden: FieldKey[] = ['department', 'address', 'custom'];
  if (!fields.company) hidden.push('company');
  if (!fields.phone) hidden.push('phones');
  if (!fields.email) hidden.push('email');
  if (!fields.website) hidden.push('websites');
  if (!fields.tagline && !fields.status) hidden.push('tagline');
  return hidden;
}

/** Switch a config to a Simple Style design without losing the user's content or accent colour. */
export function applySimplePreset(base: SignatureConfig, id: SimplePresetId): SignatureConfig {
  const p = SIMPLE_PRESETS[id];
  return reparse({
    ...base,
    presetId: id,
    layout: {
      ...base.layout,
      id: p.layout,
      sections: { ...base.layout.sections, ...defaultSections, ...p.patch.layoutSections },
    },
    // `ring`/`color` are always cleared (never carried over from Custom Style or a previous
    // design), so avatar and mark both fall back to the live `theme.accent` — see the note above.
    avatar: { ...base.avatar, ring: undefined, ...(p.patch.avatar ?? { animation: 'none' }) },
    mark: { ...base.mark, color: undefined, ...p.patch.mark },
    theme: {
      ...base.theme,
      palette: undefined,
      background: p.patch.background ?? 'transparent',
      darkMode: p.patch.darkMode ?? 'auto',
      contactSeparator: 'pipe',
    },
    extras: {
      ...base.extras,
      alignment: 'left',
      taglineStyle: p.patch.taglineStyle ?? 'plain',
      banner: { ...base.extras.banner, enabled: false, ...(p.patch.banner ?? {}) },
    },
    details: {
      ...base.details,
      hidden: hiddenForSimple(p.fields),
      ...(p.patch.fieldOrder
        ? { fieldOrder: [...p.patch.fieldOrder, ...unlisted(p.patch.fieldOrder)] }
        : {}),
    },
  });
}

// Every section this system touches defaults back to "on"; only the current preset's explicit
// overrides turn one off, so switching designs never leaves a stale section hidden.
const defaultSections = {
  avatar: true,
  mark: true,
  social: true,
  banner: true,
  cta: true,
  disclaimer: true,
  badges: true,
  logo: true,
};

function unlisted(order: FieldKey[]): FieldKey[] {
  const all: FieldKey[] = [
    'title',
    'department',
    'company',
    'phones',
    'email',
    'websites',
    'address',
    'tagline',
    'custom',
  ];
  return all.filter((k) => !order.includes(k));
}

export function createFromSimplePreset(
  id: SimplePresetId,
  details: SignatureConfigInput['details'],
): SignatureConfig {
  return applySimplePreset(createConfig({ details, theme: { accent: SIMPLE_DEFAULT_ACCENT } }), id);
}
