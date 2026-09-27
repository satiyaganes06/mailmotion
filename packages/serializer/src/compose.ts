import { getLayoutSpec, avatarPx } from '@mailmotion/layouts';
import { TABLE_ATTRS, esc, style } from './html';
import {
  avatarImg,
  bannerBlock,
  badgesBlock,
  ctaBlock,
  dividerRow,
  disclaimerRow,
  fieldRows,
  greenNoteRow,
  logoBlock,
  madeWithRow,
  markImg,
  nameHtml,
  row,
  socialBlock,
  textTd,
  type Ctx,
} from './blocks';

const GUTTER = 16;

function padTd(ctx: Ctx, inner: string, extra: Record<string, string | number> = {}): string {
  const centered = ctx.t.align === 'center';
  return `<tr><td${centered ? ' align="center"' : ''} style="${style({ padding: `${ctx.t.gap.block}px 0 0`, ...extra })}">${inner}</td></tr>`;
}

interface InfoOptions {
  /** Render the social block inside the info column. */
  social: boolean;
  /** Render the mark inside the info column when positioned above/below/beside/replace. */
  mark: boolean;
}

/** The text column: name, fields, socials and (optionally) the mark. Returns `<tr>` rows. */
function infoRows(ctx: Ctx, o: InfoOptions): string {
  const { cfg } = ctx;
  const mark = o.mark ? markImg(ctx) : '';
  const pos = cfg.mark.position;
  const social = cfg.socials.position === 'beside' ? '' : o.social ? socialBlock(ctx) : '';
  let out = '';

  if (mark && pos === 'above')
    out += `<tr><td${ctx.t.align === 'center' ? ' align="center"' : ''} style="padding:0 0 ${ctx.t.gap.row + 2}px">${mark}</td></tr>`;

  if (mark && pos === 'replace') {
    out += `<tr><td${ctx.t.align === 'center' ? ' align="center"' : ''} style="padding:0 0 ${ctx.t.gap.row + 2}px">${mark}</td></tr>`;
  } else if (mark && pos === 'beside') {
    const nameTd = textTd(ctx, 'name', nameHtml(ctx), { padding: '0 10px 0 0' });
    out += `<tr><td style="padding:0 0 ${ctx.t.gap.row}px"><table ${TABLE_ATTRS}><tr>${nameTd}<td valign="middle">${mark}</td></tr></table></td></tr>`;
  } else if (cfg.socials.position === 'beside' && socialBlock(ctx)) {
    const nameTd = textTd(ctx, 'name', nameHtml(ctx), { padding: '0 12px 0 0' });
    out += `<tr><td style="padding:0 0 ${ctx.t.gap.row}px"><table ${TABLE_ATTRS}><tr>${nameTd}<td valign="middle">${socialBlock(ctx)}</td></tr></table></td></tr>`;
  } else {
    out += row(textTd(ctx, 'name', nameHtml(ctx)));
  }

  out += fieldRows(ctx).join('');
  if (social) out += padTd(ctx, social, { padding: `${ctx.t.gap.block - 2}px 0 0` });
  if (mark && pos === 'below') out += padTd(ctx, mark, { padding: `${ctx.t.gap.row + 4}px 0 0` });
  return out;
}

function infoTable(ctx: Ctx, rows: string): string {
  return `<table ${TABLE_ATTRS}${ctx.t.align === 'center' ? ' align="center"' : ''}>${rows}</table>`;
}

function avatarTd(ctx: Ctx, side: 'left' | 'top'): string {
  const av = avatarImg(ctx);
  if (!av) return '';
  if (side === 'top') {
    const al = ctx.t.align === 'center' ? 'center' : 'left';
    return `<td align="${al}" style="padding:0 0 ${ctx.t.gap.block - 2}px">${av}</td>`;
  }
  return `<td valign="middle" style="padding:0 ${GUTTER}px 0 0">${av}</td>`;
}

function infoWidth(ctx: Ctx, hasAvatar: boolean, ruleWidth: number): number {
  const av = hasAvatar ? avatarPx(ctx.cfg) + GUTTER : 0;
  return Math.max(160, ctx.t.width - av - ruleWidth - (ruleWidth ? GUTTER : 0));
}

/** Avatar left, info right, with an optional vertical rule. */
function sideBySide(
  ctx: Ctx,
  opts: { rule: 'none' | 'thin' | 'thick'; info: InfoOptions },
): string {
  const av = avatarTd(ctx, 'left');
  const ruleW = av ? (opts.rule === 'thick' ? 3 : opts.rule === 'thin' ? 1 : 0) : 0;
  const ruleColor = opts.rule === 'thick' ? ctx.t.colors.accent : ctx.t.colors.rule;
  const w = infoWidth(ctx, Boolean(av), ruleW);
  const st = ruleW
    ? `border-left:${ruleW}px solid ${ruleColor};padding:0 0 0 ${GUTTER}px`
    : 'padding:0';
  const info = `<td valign="middle" width="${w}" style="${st}">${infoTable(ctx, infoRows(ctx, opts.info))}</td>`;
  return `<tr><td><table ${TABLE_ATTRS}><tr>${av}${info}</tr></table></td></tr>`;
}

function editorial(ctx: Ctx): string {
  const { cfg, t } = ctx;
  const mark = markImg(ctx);
  const headline = mark && cfg.mark.position === 'above';
  if (!headline)
    return sideBySide(ctx, {
      rule: 'none',
      info: { social: cfg.socials.position === 'below', mark: true },
    });

  const av = avatarTd(ctx, 'left');
  const center = t.align === 'center';
  const head = `<tr><td${center ? ' align="center"' : ''}><table ${TABLE_ATTRS}${center ? ' align="center"' : ''}><tr>${av}<td valign="middle">${mark}</td></tr></table></td></tr>`;

  const d = cfg.details;
  const caps = (s: string) => esc(s.toUpperCase());
  const line = [caps(d.fullName), d.title ? esc(d.title) : ''].filter(Boolean).join(' &mdash; ');
  const lineRow = row(
    textTd(ctx, 'title', line + (d.department ? ` &middot; ${esc(d.department)}` : ''), {
      'letter-spacing': '0.8px',
      padding: `${t.gap.block}px 0 ${t.gap.row}px`,
    }),
  );
  const rest = fieldRows(ctx, ['title', 'department']).join('');
  const social = cfg.socials.position === 'below' ? socialBlock(ctx) : '';
  const body =
    lineRow + rest + (social ? padTd(ctx, social, { padding: `${t.gap.block - 2}px 0 0` }) : '');
  return head + `<tr><td>${infoTable(ctx, body)}</td></tr>`;
}

function stacked(ctx: Ctx): string {
  const av = avatarTd(ctx, 'top');
  const center = ctx.t.align === 'center';
  const info = infoTable(
    ctx,
    infoRows(ctx, { social: ctx.cfg.socials.position === 'below', mark: true }),
  );
  return (
    (av ? `<tr>${av}</tr>` : '') + `<tr><td${center ? ' align="center"' : ''}>${info}</td></tr>`
  );
}

function bannerLayout(ctx: Ctx): string {
  const top = sideBySide(ctx, { rule: 'none', info: { social: false, mark: false } });
  const strip = bannerBlock(ctx);
  const social = socialBlock(ctx);
  const mark = markImg(ctx);
  let out = top;
  if (strip) out += padTd(ctx, strip);
  if (social && ctx.cfg.socials.position !== 'beside') out += padTd(ctx, social);
  if (mark) out += padTd(ctx, mark, { padding: `${ctx.t.gap.row + 4}px 0 0` });
  return out;
}

/** All rows for the chosen layout (no extras, no wrapper). */
export function composeLayout(ctx: Ctx): string {
  const id = ctx.cfg.layout.id;
  const spec = getLayoutSpec(id);
  switch (id) {
    case 'card':
    case 'left-portrait':
    case 'bordered':
      return sideBySide(ctx, {
        rule: spec.rule,
        info: { social: ctx.cfg.socials.position === 'below', mark: true },
      });
    case 'editorial':
      return editorial(ctx);
    case 'banner':
      return bannerLayout(ctx);
    case 'stacked':
      return stacked(ctx);
  }
}

/** Rows that follow the main block: banner (non-banner layouts), CTA, logo, badges, divider, small print. */
export function composeExtras(ctx: Ctx, opts: { skipBanner: boolean }): string {
  const { cfg } = ctx;
  let out = '';
  const rowsIf = (html: string) => (html ? padTd(ctx, html) : '');

  // socials placed as their own full-width row
  if (cfg.socials.position === 'row' && cfg.layout.id !== 'banner') out += rowsIf(socialBlock(ctx));
  if (!opts.skipBanner) out += rowsIf(bannerBlock(ctx));
  out += rowsIf(ctaBlock(ctx));
  out += rowsIf(logoBlock(ctx));
  out += rowsIf(badgesBlock(ctx));

  const small = disclaimerRow(ctx) + greenNoteRow(ctx) + madeWithRow(ctx);
  if (small) out += dividerRow(ctx) + small;
  else if (out && cfg.extras.divider !== 'none') out += dividerRow(ctx);
  return out;
}
