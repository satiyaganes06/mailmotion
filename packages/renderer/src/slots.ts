import {
  AVATAR_ANIMATION_DEFS,
  avatarTimeline,
  bannerTimeline,
  drawBanner,
  drawLogo,
  logoTimeline,
  type AvatarParams,
  type Frame,
} from '@mailmotion/animations';
import { accessibleAccent, ensureContrast, mix, readableOn } from '@mailmotion/contrast';
import { drawIcon } from '@mailmotion/icons';
import {
  PEN_WIDTH_1X,
  UI_FONT_FILE,
  drawFadeInk,
  drawStrokeInk,
  drawTypedInk,
  getInkFont,
  inkTimeline,
  layoutInk,
  loadFont,
  markText,
  textPath,
  type Font,
} from '@mailmotion/ink';
import { BADGE_HEIGHT, DIVIDER_SIZE, type SlotPlan } from '@mailmotion/layouts';
import { getPlatform, type Paint, type SignatureConfig } from '@mailmotion/schema';
import { surface, pixels, type RenderEnv, type Surface } from './env';
import { encodeWithBudget, type RawFrame } from './gif';
import { applyFilter, containImage, cropSquare, duotoneColors } from './imaging';

export interface RenderedAsset {
  slotId: string;
  kind: SlotPlan['kind'];
  format: 'gif' | 'png';
  bytes: Uint8Array;
  /** SHA-256 hex of `bytes`. */
  hash: string;
  /** `<hash>.<format>`: content-hashed so mail-client image caches pick up edits. */
  fileName: string;
  /** Display size in CSS pixels (files are rendered at up to 2x). */
  width: number;
  height: number;
  frames: number;
  /** Render scale actually used (2 = full quality). */
  scale: number;
  /** Quality reductions applied to fit the byte budget. */
  degraded: string[];
  /** False only if even the smallest encoding exceeded the budget. */
  fitsBudget: boolean;
  delaysMs: number[];
}

const RS = 2;

async function finish(
  env: RenderEnv,
  slot: SlotPlan,
  bytes: Uint8Array,
  extra: Partial<RenderedAsset> & Pick<RenderedAsset, 'width' | 'height' | 'format'>,
): Promise<RenderedAsset> {
  const hash = await env.sha256(bytes);
  return {
    slotId: slot.id,
    kind: slot.kind,
    bytes,
    hash,
    fileName: `${hash}.${extra.format}`,
    frames: 1,
    scale: RS,
    degraded: [],
    fitsBudget: true,
    delaysMs: [],
    ...extra,
  };
}

async function png(
  env: RenderEnv,
  slot: SlotPlan,
  s: Surface,
  w: number,
  h: number,
): Promise<RenderedAsset> {
  return finish(env, slot, await env.encodePng(s.canvas), { width: w, height: h, format: 'png' });
}

async function animated(
  env: RenderEnv,
  slot: SlotPlan,
  w: number,
  h: number,
  render: (scale: number) => RawFrame[],
  loopCount = 0,
): Promise<RenderedAsset> {
  const r = encodeWithBudget(
    render,
    (s) => ({ width: Math.round(w * s), height: Math.round(h * s) }),
    loopCount,
  );
  return finish(env, slot, r.bytes, {
    width: w,
    height: h,
    format: 'gif',
    frames: r.frameCount,
    scale: r.attempt.scale,
    degraded: r.degraded,
    fitsBudget: r.fits,
    delaysMs: [],
  });
}

/* ------------------------------------------------------------------ shared helpers */

const secondaryOf = (cfg: SignatureConfig) =>
  cfg.theme.secondary ?? mix(cfg.theme.accent, '#ffffff', 0.35);

function ringOf(cfg: SignatureConfig): Paint {
  if (cfg.avatar.ring) return cfg.avatar.ring;
  return cfg.theme.secondary
    ? { from: cfg.theme.accent, to: cfg.theme.secondary }
    : cfg.theme.accent;
}

function initialsOf(cfg: SignatureConfig): string {
  if (cfg.avatar.initials) return cfg.avatar.initials;
  return cfg.details.fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const uiFont = (env: RenderEnv) => loadFont(env.loadFont, UI_FONT_FILE);

/* ------------------------------------------------------------------ avatar */

export async function renderAvatar(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const px = slot.width;
  const a = cfg.avatar;
  const image = a.source !== 'initials' && a.image ? await env.loadImage(a.image) : null;
  const initials = textPath(await uiFont(env), initialsOf(cfg));
  const secondary = secondaryOf(cfg);
  const duo = duotoneColors(cfg.theme.accent, secondary);
  const anim = AVATAR_ANIMATION_DEFS[a.animation];
  const timeline = avatarTimeline(a.animation, a.speed);

  const build = (scale: number) => {
    const size = Math.round(px * scale);
    let photo: Surface | null = null;
    if (image) {
      photo =
        a.source === 'logo' ? containImage(env, image, size) : cropSquare(env, image, size, a.crop);
      applyFilter(photo, a.filter, duo.dark, duo.light);
    }
    const s = surface(env, size, size);
    const params: AvatarParams = {
      env,
      size,
      shape: a.shape,
      image: photo?.canvas ?? null,
      initials,
      accent: cfg.theme.accent,
      secondary,
      ring: ringOf(cfg),
    };
    return { s, params };
  };

  if (timeline.length === 1) {
    const { s, params } = build(RS);
    anim.draw(s.ctx, params, 0);
    return png(env, slot, s, px, px);
  }
  return animated(env, slot, px, px, (scale) => {
    const { s, params } = build(scale);
    return timeline.map((f: Frame) => {
      s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
      anim.draw(s.ctx, params, f.t);
      return { data: pixels(s), delayMs: f.delayMs };
    });
  });
}

/* ------------------------------------------------------------------ signature mark */

export async function renderMark(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const m = cfg.mark;
  const w = slot.width;
  const h = slot.height;
  const { frames, loopCount } = inkTimeline({
    animation: m.animation,
    speed: m.speed,
    holdMs: m.holdMs,
    loop: m.loop,
  });
  const color: Paint = m.color ?? accessibleAccent(cfg.theme.accent);

  const typed = m.mode === 'typed' || !m.strokes?.length;
  const font: Font | null = typed ? await loadFont(env.loadFont, getInkFont(m.font).file) : null;
  const text = markText(cfg);

  const build = (scale: number) => {
    const W = Math.round(w * scale);
    const H = Math.round(h * scale);
    const s = surface(env, W, H);
    const style = { color, penWidth: PEN_WIDTH_1X[m.strokeWidth] * scale, glow: m.glow };
    const layout = font ? layoutInk(font, text, W, H) : null;
    const pad = Math.round(Math.min(W, H) * 0.06);
    const box = { x: pad, y: pad, width: W - pad * 2, height: H - pad * 2 };
    const drawAt = (progress: number) => {
      s.ctx.clearRect(0, 0, W, H);
      if (layout) {
        if (m.animation === 'fade') drawFadeInk(s.ctx, env, layout, style, progress);
        else drawTypedInk(s.ctx, env, layout, style, m.animation === 'none' ? 1 : progress);
      } else if (m.animation === 'fade') {
        s.ctx.save();
        s.ctx.globalAlpha = Math.min(1, progress);
        drawStrokeInk(s.ctx, m.strokes!, box, style, 1);
        s.ctx.restore();
      } else {
        drawStrokeInk(s.ctx, m.strokes!, box, style, m.animation === 'none' ? 1 : progress);
      }
    };
    return { s, drawAt };
  };

  if (frames.length === 1) {
    const { s, drawAt } = build(RS);
    drawAt(1);
    return png(env, slot, s, w, h);
  }
  return animated(
    env,
    slot,
    w,
    h,
    (scale) => {
      const { s, drawAt } = build(scale);
      return frames.map((f) => {
        drawAt(f.progress);
        return { data: pixels(s), delayMs: f.delayMs };
      });
    },
    loopCount,
  );
}

/* ------------------------------------------------------------------ display name (baked) */

export async function renderDisplayName(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const font = await loadFont(env.loadFont, getInkFont(cfg.mark.font).file);
  const size = cfg.typography.nameSize * 1.5;
  const probe = font.getPath(cfg.details.fullName, 0, 0, size).getBoundingBox();
  const w = Math.max(24, Math.ceil(probe.x2 - probe.x1) + 6);
  const h = Math.ceil(cfg.typography.nameSize * 1.9);
  const s = surface(env, w * RS, h * RS);
  const layout = layoutInk(font, cfg.details.fullName, w * RS, h * RS);
  const color = ensureContrast(cfg.theme.textColors.name, '#ffffff', 4.5);
  drawTypedInk(s.ctx, env, layout, { color, penWidth: 1, glow: false }, 1);
  return png(env, slot, s, w, h);
}

/* ------------------------------------------------------------------ banner */

export async function renderBanner(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const b = cfg.extras.banner;
  const colorA = b.colorA ?? cfg.theme.accent;
  const colorB = b.colorB ?? secondaryOf(cfg);
  const text = b.text ? textPath(await uiFont(env), b.text) : null;
  const image = b.kind === 'static' && b.image ? await env.loadImage(b.image) : null;
  const textColor = readableOn(mix(colorA, colorB, 0.5));
  const timeline = bannerTimeline(b.kind, 'normal');

  const build = (scale: number) => {
    const W = Math.round(slot.width * scale);
    const H = Math.round(slot.height * scale);
    return {
      s: surface(env, W, H),
      params: { env, width: W, height: H, kind: b.kind, colorA, colorB, text, textColor, image },
    };
  };
  if (timeline.length === 1) {
    const { s, params } = build(RS);
    drawBanner(s.ctx, params, 0);
    return png(env, slot, s, slot.width, slot.height);
  }
  return animated(env, slot, slot.width, slot.height, (scale) => {
    const { s, params } = build(scale);
    return timeline.map((f) => {
      s.ctx.clearRect(0, 0, params.width, params.height);
      drawBanner(s.ctx, params, f.t);
      return { data: pixels(s), delayMs: f.delayMs };
    });
  });
}

/* ------------------------------------------------------------------ logo */

export async function renderLogo(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const l = cfg.extras.logo;
  const image = await env.loadImage(l.image!);
  const w = l.width;
  const h = Math.max(1, Math.round((w * image.height) / image.width));
  const build = (scale: number) => surface(env, Math.round(w * scale), Math.round(h * scale));
  if (!l.animated) {
    const s = build(RS);
    drawLogo(s.ctx, image, s.canvas.width, s.canvas.height, 0);
    return png(env, slot, s, w, h);
  }
  const timeline = logoTimeline('normal');
  return animated(env, slot, w, h, (scale) => {
    const s = build(scale);
    return timeline.map((f) => {
      drawLogo(s.ctx, image, s.canvas.width, s.canvas.height, f.t);
      return { data: pixels(s), delayMs: f.delayMs };
    });
  });
}

/* ------------------------------------------------------------------ social icons */

export async function renderSocialIcon(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const index = Number(slot.id.split(':')[1]);
  const item = cfg.socials.items[index]!;
  const px = slot.width;
  const info = getPlatform(item.platform);
  const single = cfg.socials.singleColor ?? accessibleAccent(cfg.theme.accent);
  const color = cfg.socials.iconColor === 'brand' ? (info?.brand ?? single) : single;
  const image = item.customIcon ? await env.loadImage(item.customIcon) : null;
  const s = surface(env, px * RS, px * RS);
  drawIcon(s.ctx, env, px * RS, {
    platform: item.platform,
    style: cfg.socials.iconStyle,
    color,
    badgeGlyph: readableOn(color),
    image,
  });
  return png(env, slot, s, px, px);
}

/* ------------------------------------------------------------------ badges + divider */

export async function renderBadge(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const index = Number(slot.id.split(':')[1]);
  const image = await env.loadImage(cfg.extras.badges[index]!.image);
  const h = BADGE_HEIGHT;
  const w = Math.max(8, Math.min(96, Math.round((h * image.width) / image.height)));
  const s = surface(env, w * RS, h * RS);
  s.ctx.imageSmoothingQuality = 'high';
  s.ctx.drawImage(image as unknown as CanvasImageSource, 0, 0, w * RS, h * RS);
  return png(env, slot, s, w, h);
}

export async function renderDivider(
  env: RenderEnv,
  cfg: SignatureConfig,
  slot: SlotPlan,
): Promise<RenderedAsset> {
  const { width, height } = DIVIDER_SIZE;
  const s = surface(env, width * RS, height * RS);
  const g = s.ctx.createLinearGradient(0, 0, width * RS, 0);
  g.addColorStop(0, cfg.theme.accent);
  g.addColorStop(1, secondaryOf(cfg));
  s.ctx.fillStyle = g;
  s.ctx.fillRect(0, 0, width * RS, height * RS);
  return png(env, slot, s, width, height);
}
