import {
  createConfig,
  type AvatarAnimationId,
  type LayoutId,
  type MarkAnimationId,
  type PaletteId,
  type PresetId,
  type SignatureConfig,
  type SignatureConfigInput,
} from '@mailmotion/schema';
import { PALETTES } from './palettes';

export interface PresetDef {
  id: PresetId;
  name: string;
  layout: LayoutId;
  avatarAnimation: AvatarAnimationId;
  markStyle: string;
  frame1: string;
  bestFor: string;
  source: 'Signature Set' | 'Vivid Set';
  /** Fields applied over the user's config. Details, photo, socials and strokes are never touched. */
  patch: {
    avatar: Partial<SignatureConfig['avatar']>;
    mark: Partial<SignatureConfig['mark']>;
    theme: { accent: string; secondary: string; palette?: PaletteId };
    extras?: {
      alignment?: 'left' | 'center';
      banner?: Partial<SignatureConfig['extras']['banner']>;
    };
    layoutWidth?: 'mobile' | 'wide';
  };
}

export const PRESETS: Record<PresetId, PresetDef> = {
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    layout: 'card',
    avatarAnimation: 'aurora',
    markStyle: 'Ink draw',
    frame1: 'Ring complete, name inked',
    bestFor: 'Anyone, professional default',
    source: 'Signature Set',
    patch: {
      avatar: { animation: 'aurora', shape: 'circle', size: 'L' },
      mark: { animation: 'ink', position: 'below', size: 'S', glow: false },
      theme: { accent: '#b34700', secondary: '#e2793d' },
    },
  },
  portrait: {
    id: 'portrait',
    name: 'Portrait',
    layout: 'left-portrait',
    avatarAnimation: 'strip-reveal',
    markStyle: 'Ink draw',
    frame1: 'Photo fully revealed',
    bestFor: 'Personal brands, sales, consultants',
    source: 'Signature Set',
    patch: {
      avatar: { animation: 'strip-reveal', shape: 'rounded', size: 'M' },
      mark: { animation: 'ink', position: 'below', size: 'M', glow: false },
      theme: { accent: '#b34700', secondary: '#7a3010' },
    },
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    layout: 'editorial',
    avatarAnimation: 'pulse',
    markStyle: 'Large ink signature as the headline',
    frame1: 'Solid avatar, name inked',
    bestFor: 'Writers, lawyers, founders',
    source: 'Signature Set',
    patch: {
      avatar: { animation: 'pulse', shape: 'circle', size: 'S' },
      mark: { animation: 'ink', position: 'above', size: 'L', glow: false },
      theme: { accent: '#b34700', secondary: '#7a3010' },
      extras: { alignment: 'left' },
    },
  },
  wave: {
    id: 'wave',
    name: 'Wave',
    layout: 'banner',
    avatarAnimation: 'orbit',
    markStyle: 'Ink draw (gradient)',
    frame1: 'Ring and banner complete',
    bestFor: 'Brand-led teams',
    source: 'Vivid Set',
    patch: {
      avatar: {
        animation: 'orbit',
        shape: 'circle',
        size: 'M',
        ring: { from: '#06b6d4', to: '#6366f1' },
      },
      mark: {
        animation: 'ink',
        position: 'below',
        size: 'M',
        glow: false,
        color: { from: '#06b6d4', to: '#6366f1' },
      },
      theme: { accent: '#6366f1', secondary: '#06b6d4' },
      extras: {
        banner: { enabled: true, kind: 'wave', colorA: '#06b6d4', colorB: '#6366f1', height: 48 },
      },
    },
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    layout: 'bordered',
    avatarAnimation: 'neon',
    markStyle: 'Neon-ink draw',
    frame1: 'Mark lit',
    bestFor: 'Creative studios, after-dark brands',
    source: 'Vivid Set',
    patch: {
      avatar: {
        animation: 'neon',
        shape: 'rounded',
        size: 'M',
        ring: { from: '#e879f9', to: '#7c3aed' },
      },
      mark: {
        animation: 'ink',
        position: 'below',
        size: 'M',
        glow: true,
        color: { from: '#e879f9', to: '#7c3aed' },
      },
      theme: { accent: '#7c3aed', secondary: '#e879f9' },
    },
  },
  equalizer: {
    id: 'equalizer',
    name: 'Equalizer',
    layout: 'stacked',
    avatarAnimation: 'equalizer',
    markStyle: 'Ink draw (gradient)',
    frame1: 'Bars at rest, name inked',
    bestFor: 'Podcasters, musicians, mobile-first',
    source: 'Vivid Set',
    patch: {
      avatar: {
        animation: 'equalizer',
        shape: 'circle',
        size: 'M',
        ring: { from: '#f59e0b', to: '#ec4899' },
      },
      mark: {
        animation: 'ink',
        position: 'below',
        size: 'M',
        glow: false,
        color: { from: '#f59e0b', to: '#ec4899' },
      },
      theme: { accent: '#ec4899', secondary: '#f59e0b' },
      extras: { alignment: 'center' },
    },
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export function getPreset(id: PresetId): PresetDef {
  return PRESETS[id];
}

function reparse(c: unknown): SignatureConfig {
  return createConfig(c as SignatureConfigInput);
}

/** Switch a config to a preset design without losing the user's content. */
export function applyPreset(base: SignatureConfig, id: PresetId): SignatureConfig {
  const p = PRESETS[id];
  return reparse({
    ...base,
    presetId: id,
    layout: { ...base.layout, id: p.layout, width: p.patch.layoutWidth ?? base.layout.width },
    avatar: { ...base.avatar, ...p.patch.avatar },
    mark: { ...base.mark, ...p.patch.mark },
    theme: { ...base.theme, ...p.patch.theme, palette: p.patch.theme.palette },
    extras: {
      ...base.extras,
      alignment: p.patch.extras?.alignment ?? base.extras.alignment,
      banner: { ...base.extras.banner, ...(p.patch.extras?.banner ?? {}) },
    },
  });
}

export function createFromPreset(
  id: PresetId,
  details: SignatureConfigInput['details'],
): SignatureConfig {
  return applyPreset(createConfig({ details }), id);
}

export interface RemixParts {
  layout?: LayoutId;
  avatarAnimation?: AvatarAnimationId;
  markAnimation?: MarkAnimationId;
  palette?: PaletteId;
}

/** Mix parts from different designs, e.g. the Neon avatar on the Editorial layout. */
export function remix(base: SignatureConfig, parts: RemixParts): SignatureConfig {
  const palette = parts.palette ? PALETTES[parts.palette] : undefined;
  const layoutChanged = parts.layout !== undefined && parts.layout !== base.layout.id;
  return reparse({
    ...base,
    presetId: undefined,
    extras: layoutChanged
      ? { ...base.extras, alignment: parts.layout === 'stacked' ? 'center' : 'left' }
      : base.extras,
    layout: { ...base.layout, id: parts.layout ?? base.layout.id },
    avatar: { ...base.avatar, animation: parts.avatarAnimation ?? base.avatar.animation },
    mark: { ...base.mark, animation: parts.markAnimation ?? base.mark.animation },
    theme: palette
      ? { ...base.theme, accent: palette.accent, secondary: palette.secondary, palette: palette.id }
      : base.theme,
  });
}

export function applyPalette(base: SignatureConfig, id: PaletteId): SignatureConfig {
  return remix(base, { palette: id });
}
