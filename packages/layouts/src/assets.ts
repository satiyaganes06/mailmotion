import {
  AVATAR_SIZES,
  ICON_SIZES,
  LIMITS,
  MARK_SIZES,
  resolveVariant,
  type SignatureConfig,
} from '@mailmotion/schema';

export type SlotKind =
  'avatar' | 'mark' | 'displayName' | 'banner' | 'logo' | 'icon' | 'badge' | 'divider';

/** One image a signature needs. `width`/`height` are display (1x) pixels; files are rendered at 2x. */
export interface SlotPlan {
  id: string;
  kind: SlotKind;
  width: number;
  height: number;
  format: 'gif' | 'png';
  animated: boolean;
}

/** A rendered/hosted image the serializer can reference. */
export interface AssetRef {
  url: string;
  width: number;
  height: number;
}

export interface SignatureAssets {
  slots: Record<string, AssetRef>;
}

export const RENDER_SCALE = 2;
export const BADGE_HEIGHT = 36;
export const DIVIDER_SIZE = { width: 400, height: 3 } as const;

export function avatarPx(config: SignatureConfig): number {
  return AVATAR_SIZES[config.avatar.size];
}

export function markSize(config: SignatureConfig): { width: number; height: number } {
  const base = MARK_SIZES[config.mark.size];
  const layoutFactor =
    config.layout.id === 'editorial' && config.mark.position === 'above' ? 1.2 : 1;
  const height = Math.round(base.h * layoutFactor);
  if (config.mark.mode !== 'typed' && config.mark.strokesAspect) {
    const maxW = config.layout.width === 'wide' ? 300 : 260;
    const width = Math.min(maxW, Math.round(height * config.mark.strokesAspect));
    return { width, height: Math.round(width / config.mark.strokesAspect) };
  }
  return { width: Math.round(base.w * layoutFactor), height };
}

export function mainWidth(config: SignatureConfig): number {
  return config.layout.width === 'wide' ? LIMITS.wideWidth : LIMITS.mainWidth;
}

/**
 * Every image the signature needs, in stable order, after applying the active variant.
 * The renderer draws exactly these; the serializer references exactly these.
 */
export function planAssets(input: SignatureConfig): SlotPlan[] {
  const config = resolveVariant(input);
  const s = config.layout.sections;
  const slots: SlotPlan[] = [];

  if (s.avatar) {
    const px = avatarPx(config);
    const animated = config.avatar.animation !== 'none';
    slots.push({
      id: 'avatar',
      kind: 'avatar',
      width: px,
      height: px,
      format: animated ? 'gif' : 'png',
      animated,
    });
  }

  if (s.mark && config.mark.enabled) {
    const { width, height } = markSize(config);
    const animated = config.mark.animation !== 'none';
    slots.push({
      id: 'mark',
      kind: 'mark',
      width,
      height,
      format: animated ? 'gif' : 'png',
      animated,
    });
  }

  if (config.typography.displayName) {
    const size = config.typography.nameSize;
    slots.push({
      id: 'displayName',
      kind: 'displayName',
      width: Math.min(320, Math.ceil(config.details.fullName.length * size * 0.6)),
      height: Math.ceil(size * 1.7),
      format: 'png',
      animated: false,
    });
  }

  const banner = config.extras.banner;
  if (s.banner && banner.enabled) {
    const isImage = banner.kind === 'static';
    slots.push({
      id: 'banner',
      kind: 'banner',
      width: LIMITS.stripWidth,
      height: banner.height,
      format: isImage ? 'png' : 'gif',
      animated: !isImage,
    });
  }

  const logo = config.extras.logo;
  if (s.logo && logo.enabled && logo.image) {
    slots.push({
      id: 'logo',
      kind: 'logo',
      width: logo.width,
      height: logo.width,
      format: logo.animated ? 'gif' : 'png',
      animated: logo.animated,
    });
  }

  if (s.social && !config.socials.textLinks) {
    const size = ICON_SIZES.includes(config.socials.iconSize) ? config.socials.iconSize : 24;
    config.socials.items.forEach((_, i) =>
      slots.push({
        id: `icon:${i}`,
        kind: 'icon',
        width: size,
        height: size,
        format: 'png',
        animated: false,
      }),
    );
  }

  if (s.badges) {
    config.extras.badges.forEach((_, i) =>
      slots.push({
        id: `badge:${i}`,
        kind: 'badge',
        width: BADGE_HEIGHT * 2,
        height: BADGE_HEIGHT,
        format: 'png',
        animated: false,
      }),
    );
  }

  if (config.extras.divider === 'gradient') {
    slots.push({
      id: 'divider',
      kind: 'divider',
      width: DIVIDER_SIZE.width,
      height: DIVIDER_SIZE.height,
      format: 'png',
      animated: false,
    });
  }

  return slots;
}

/**
 * Placeholder assets with realistic-length URLs, for live previews and the character budget
 * before anything has been published. `baseUrl` should be the URL the user will host under.
 */
export function placeholderAssets(
  config: SignatureConfig,
  baseUrl = 'https://img.example.com',
): SignatureAssets {
  const base = baseUrl.replace(/\/+$/, '');
  const slots: Record<string, AssetRef> = {};
  for (const p of planAssets(config)) {
    const fake = (p.id.replace(/\W/g, '') + '0'.repeat(64)).slice(0, 64);
    slots[p.id] = { url: `${base}/${fake}.${p.format}`, width: p.width, height: p.height };
  }
  return { slots };
}
