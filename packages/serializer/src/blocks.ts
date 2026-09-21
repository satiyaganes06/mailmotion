import { readableOn, ensureContrast } from '@mailmotion/contrast';
import type { SignatureAssets } from '@mailmotion/layouts';
import { getPlatform, type FieldKey, type SignatureConfig } from '@mailmotion/schema';
import {
  TABLE_ATTRS,
  esc,
  escMultiline,
  img,
  link,
  mailtoHref,
  safeHref,
  style,
  telHref,
} from './html';
import { lineHeightPx, type Tokens } from './tokens';

export interface Ctx {
  cfg: SignatureConfig;
  t: Tokens;
  assets: SignatureAssets;
  allowLocalPreview: boolean;
}

export const MAILMOTION_URL = 'https://github.com/satiyaganes06/mailmotion';

type Kind = 'name' | 'title' | 'body' | 'small';

function alignAttr(ctx: Ctx): string {
  return ctx.t.align === 'center' ? ' align="center"' : '';
}

/** A text `<td>` with all typography inlined (Outlook needs it on every cell). */
export function textTd(
  ctx: Ctx,
  kind: Kind,
  inner: string,
  extra: Record<string, string | number | undefined | false> = {},
): string {
  const { t } = ctx;
  const size = kind === 'name' ? t.nameSize : kind === 'small' ? t.smallSize : t.bodySize;
  const color =
    kind === 'name'
      ? t.colors.name
      : kind === 'title'
        ? t.colors.title
        : kind === 'small'
          ? t.colors.muted
          : t.colors.body;
  const st = style({
    'font-family': t.font,
    'font-size': `${size}px`,
    'line-height': `${lineHeightPx(t, size)}px`,
    'font-weight': kind === 'name' ? t.nameWeight : undefined,
    'letter-spacing': kind === 'name' && t.letterSpacing !== '0' ? t.letterSpacing : undefined,
    color,
    padding: `0 0 ${t.gap.row}px`,
    ...extra,
  });
  return `<td${alignAttr(ctx)} style="${st}">${inner}</td>`;
}

export const row = (td: string) => `<tr>${td}</tr>`;

function linkStyle(ctx: Ctx, extra = ''): string {
  return `color:${ctx.t.colors.link};text-decoration:none${extra ? ';' + extra : ''}`;
}

function applyCase(text: string, mode: 'normal' | 'upper' | 'smallcaps'): string {
  return mode === 'upper' ? text.toUpperCase() : text;
}

function displayUrl(href: string): string {
  return href.replace(/^https:\/\//, '').replace(/\/$/, '');
}

/* ------------------------------------------------------------------ images */

export function markImg(ctx: Ctx): string {
  const ref = ctx.assets.slots.mark;
  if (!ref) return '';
  return img(ref, {
    alt: `${ctx.cfg.details.fullName} signature`,
    allowLocalPreview: ctx.allowLocalPreview,
  });
}

export function avatarImg(ctx: Ctx): string {
  const ref = ctx.assets.slots.avatar;
  if (!ref) return '';
  const initials =
    ctx.cfg.avatar.initials ??
    ctx.cfg.details.fullName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  return img(ref, { alt: initials, allowLocalPreview: ctx.allowLocalPreview });
}

/* ------------------------------------------------------------------ name + fields */

export function nameHtml(ctx: Ctx): string {
  const { cfg, t } = ctx;
  const display = ctx.assets.slots.displayName;
  if (display) {
    return img(display, { alt: cfg.details.fullName, allowLocalPreview: ctx.allowLocalPreview });
  }
  const text = esc(applyCase(cfg.details.fullName, cfg.typography.nameCase));
  const nameSpan =
    cfg.typography.nameCase === 'smallcaps'
      ? `<span style="font-variant:small-caps">${text}</span>`
      : text;
  const pr = cfg.details.pronouns;
  const pronouns = pr
    ? ` <span style="font-size:${t.smallSize}px;font-weight:normal;color:${t.colors.muted}">${esc(/^\(.*\)$/.test(pr) ? pr : `(${pr})`)}</span>`
    : '';
  return nameSpan + pronouns;
}

/** Title row(s), company, contact lines, tagline, custom fields, in the user's order. */
export function fieldRows(ctx: Ctx, skip: FieldKey[] = []): string[] {
  const { cfg, t } = ctx;
  const d = cfg.details;
  const hidden = new Set<FieldKey>([...d.hidden, ...skip]);
  const order = d.fieldOrder.filter((k) => !hidden.has(k));
  const rows: string[] = [];
  const titleCase = cfg.typography.titleCase;
  const tt = (s: string) => {
    const v = esc(applyCase(s, titleCase));
    return titleCase === 'smallcaps' ? `<span style="font-variant:small-caps">${v}</span>` : v;
  };

  for (let i = 0; i < order.length; i++) {
    const key = order[i]!;
    switch (key) {
      case 'title':
      case 'department': {
        const parts: string[] = [];
        // merge adjacent title + department into one line
        const next = order[i + 1];
        const pair = key === 'title' && next === 'department';
        if (key === 'title' && d.title) parts.push(tt(d.title));
        if (pair) {
          if (d.department) parts.push(tt(d.department));
          i++;
        } else if (key === 'department' && d.department) parts.push(tt(d.department));
        if (parts.length) rows.push(row(textTd(ctx, 'title', parts.join(' &middot; '))));
        break;
      }
      case 'company': {
        if (!d.company) break;
        const href = safeHref(d.companyUrl);
        const inner = href
          ? link(href, esc(d.company), linkStyle(ctx, 'font-weight:bold'))
          : `<strong>${esc(d.company)}</strong>`;
        rows.push(row(textTd(ctx, 'body', inner)));
        break;
      }
      case 'phones': {
        const items = d.phones
          .map((p) => {
            const href = telHref(p.number);
            const label = p.label ? `${esc(p.label)}: ` : '';
            return label + link(href, esc(p.number), linkStyle(ctx));
          })
          .filter(Boolean);
        if (items.length) rows.push(row(textTd(ctx, 'body', items.join(' &middot; '))));
        break;
      }
      case 'email': {
        if (!d.email) break;
        rows.push(
          row(textTd(ctx, 'body', link(mailtoHref(d.email), esc(d.email), linkStyle(ctx)))),
        );
        break;
      }
      case 'websites': {
        const items = d.websites
          .map((w) => {
            const href = safeHref(w.url);
            if (!href) return '';
            return link(href, esc(w.label || displayUrl(href)), linkStyle(ctx));
          })
          .filter(Boolean);
        if (items.length) rows.push(row(textTd(ctx, 'body', items.join(' &middot; '))));
        break;
      }
      case 'address': {
        if (!d.address?.text) break;
        const inner = escMultiline(d.address.text);
        rows.push(
          row(
            textTd(
              ctx,
              'body',
              link(safeHref(d.address.mapUrl), inner, linkStyle(ctx, 'color:' + t.colors.body)),
            ),
          ),
        );
        break;
      }
      case 'tagline': {
        if (!d.tagline) break;
        rows.push(row(textTd(ctx, 'body', esc(d.tagline), { 'font-style': 'italic' })));
        break;
      }
      case 'custom': {
        for (const f of d.customFields) {
          const val = link(safeHref(f.url), esc(f.value), linkStyle(ctx));
          rows.push(row(textTd(ctx, 'body', `${esc(f.label)}: ${val}`)));
        }
        break;
      }
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ socials */

function socialGap(ctx: Ctx): number {
  return { tight: 4, normal: 8, wide: 14 }[ctx.cfg.socials.spacing];
}

export function socialBlock(ctx: Ctx): string {
  const { cfg, t } = ctx;
  const items = cfg.socials.items;
  if (!items.length) return '';
  const centered = t.align === 'center';

  if (cfg.socials.textLinks) {
    const parts = items
      .map((it) => {
        const info = getPlatform(it.platform);
        const label = it.label || info?.label || 'Link';
        return link(safeHref(it.url), esc(label), linkStyle(ctx));
      })
      .filter(Boolean);
    return `<table ${TABLE_ATTRS}${centered ? ' align="center"' : ''}><tr>${textTd(ctx, 'body', parts.join(' &middot; '), { padding: '0' })}</tr></table>`;
  }

  const gap = socialGap(ctx);
  const size = cfg.socials.iconSize;
  const cellH = Math.max(32, size);
  const cells = items
    .map((it, i) => {
      const ref = ctx.assets.slots[`icon:${i}`];
      if (!ref) return '';
      const label = it.label || getPlatform(it.platform)?.label || 'Link';
      const image = img(ref, { alt: label, allowLocalPreview: ctx.allowLocalPreview });
      const a = link(safeHref(it.url), image);
      const pad = centered ? `0 ${gap / 2}px` : `0 ${gap}px 0 0`;
      return `<td valign="middle" height="${cellH}" style="padding:${pad};height:${cellH}px">${a}</td>`;
    })
    .join('');
  if (!cells) return '';
  return `<table ${TABLE_ATTRS}${centered ? ' align="center"' : ''}><tr>${cells}</tr></table>`;
}

/* ------------------------------------------------------------------ extras */

export function bannerBlock(ctx: Ctx): string {
  const ref = ctx.assets.slots.banner;
  if (!ref) return '';
  const b = ctx.cfg.extras.banner;
  const image = img(ref, {
    alt: b.text ?? '',
    fluid: true,
    allowLocalPreview: ctx.allowLocalPreview,
  });
  return link(safeHref(b.url), image);
}

export function ctaBlock(ctx: Ctx): string {
  const c = ctx.cfg.extras.cta;
  if (!c.enabled || !c.label) return '';
  const href = safeHref(c.url);
  if (!href) return '';
  const bg = c.background ?? ctx.t.colors.accent;
  const color = ensureContrast(c.color, bg, 4.5) === c.color ? c.color : readableOn(bg);
  return (
    `<table ${TABLE_ATTRS}${ctx.t.align === 'center' ? ' align="center"' : ''}><tr>` +
    `<td bgcolor="${bg}" style="background-color:${bg};border-radius:4px;padding:8px 18px;font-family:${ctx.t.font};font-size:${ctx.t.bodySize}px;line-height:${lineHeightPx(ctx.t, ctx.t.bodySize)}px;font-weight:bold">` +
    `<a href="${href}" style="color:${color};text-decoration:none;display:inline-block">${esc(c.label)}</a>` +
    `</td></tr></table>`
  );
}

export function logoBlock(ctx: Ctx): string {
  const ref = ctx.assets.slots.logo;
  if (!ref) return '';
  const image = img(ref, {
    alt: ctx.cfg.details.company ?? 'Logo',
    allowLocalPreview: ctx.allowLocalPreview,
  });
  return link(safeHref(ctx.cfg.extras.logo.url), image);
}

export function badgesBlock(ctx: Ctx): string {
  const cells = ctx.cfg.extras.badges
    .map((b, i) => {
      const ref = ctx.assets.slots[`badge:${i}`];
      if (!ref) return '';
      const image = img(ref, { alt: b.alt, allowLocalPreview: ctx.allowLocalPreview });
      const centered = ctx.t.align === 'center';
      return `<td valign="middle" style="padding:0 ${centered ? 4 : 8}px 0 ${centered ? 4 : 0}px">${link(safeHref(b.url), image)}</td>`;
    })
    .join('');
  if (!cells) return '';
  return `<table ${TABLE_ATTRS}${ctx.t.align === 'center' ? ' align="center"' : ''}><tr>${cells}</tr></table>`;
}

export function dividerRow(ctx: Ctx): string {
  const kind = ctx.cfg.extras.divider;
  const { t } = ctx;
  if (kind === 'none') return '';
  const spacer = `<tr><td style="height:${t.gap.block}px;font-size:1px;line-height:1px">&nbsp;</td></tr>`;
  if (kind === 'gradient') {
    const ref = ctx.assets.slots.divider;
    if (!ref) return '';
    const image = img(ref, { alt: '', fluid: true, allowLocalPreview: ctx.allowLocalPreview });
    return `${spacer}<tr><td>${image}</td></tr>`;
  }
  const border = kind === 'dotted' ? '1px dotted' : '1px solid';
  return `${spacer}<tr><td height="1" style="height:1px;font-size:1px;line-height:1px;border-top:${border} ${t.colors.rule}">&nbsp;</td></tr>`;
}

export function disclaimerRow(ctx: Ctx): string {
  const text = ctx.cfg.extras.disclaimer;
  if (!text) return '';
  const td = textTd(ctx, 'small', escMultiline(text), { padding: `${ctx.t.gap.block}px 0 0` });
  return row(td.replace('<td', `<td width="${ctx.t.width}"`));
}

export function greenNoteRow(ctx: Ctx): string {
  const e = ctx.cfg.extras;
  if (!e.greenNote) return '';
  const text = e.greenNoteText || 'Please consider the environment before printing this email.';
  const color = ensureContrast('#166534', ctx.t.surface, 4.5);
  return row(
    textTd(ctx, 'small', `&#127807; ${esc(text)}`, {
      color,
      padding: `${ctx.t.gap.row + 2}px 0 0`,
    }),
  );
}

export function madeWithRow(ctx: Ctx): string {
  if (!ctx.cfg.extras.madeWith) return '';
  return row(
    textTd(
      ctx,
      'small',
      link(
        esc(MAILMOTION_URL),
        'Made with MailMotion',
        `color:${ctx.t.colors.muted};text-decoration:underline`,
      ),
      {
        padding: `${ctx.t.gap.row + 2}px 0 0`,
      },
    ),
  );
}
