import { placeholderAssets, type SignatureAssets } from '@mailmotion/layouts';
import { resolveVariant, type SignatureConfig } from '@mailmotion/schema';
import { composeExtras, composeLayout } from './compose';
import { TABLE_ATTRS } from './html';
import { lintHtml, type LintIssue } from './lint';
import { buildTokens } from './tokens';

export interface SerializeOptions {
  /** Allow blob:/localhost image URLs (live preview). Never set for export. */
  allowLocalPreview?: boolean;
}

export interface SerializeResult {
  html: string;
  /** Length of `html` in characters (Gmail's limit applies to this). */
  chars: number;
  issues: LintIssue[];
}

/**
 * Serialize a signature config to email-safe HTML: nested tables, inline styles, hosted images.
 * Output is a single line of markup with no `<style>`, scripts or non-https URLs.
 */
export function serializeSignature(
  config: SignatureConfig,
  assets: SignatureAssets,
  opts: SerializeOptions = {},
): SerializeResult {
  const cfg = resolveVariant(config);
  const t = buildTokens(cfg);
  const ctx = { cfg, t, assets, allowLocalPreview: opts.allowLocalPreview ?? false };

  const main = composeLayout(ctx);
  const extras = composeExtras(ctx, { skipBanner: cfg.layout.id === 'banner' });
  const root = `<table ${TABLE_ATTRS} style="border-collapse:collapse;font-family:${t.font}">${main}${extras}</table>`;

  const html = t.bg
    ? `<table ${TABLE_ATTRS} bgcolor="${t.bg}" style="border-collapse:collapse;background-color:${t.bg}"><tr><td style="padding:${t.padding}px">${root}</td></tr></table>`
    : root;

  return {
    html,
    chars: html.length,
    issues: lintHtml(html, { allowLocalPreview: opts.allowLocalPreview }),
  };
}

/** Serialize with realistic placeholder URLs (for the character budget before publishing). */
export function serializeWithPlaceholders(
  config: SignatureConfig,
  baseUrl?: string,
): SerializeResult {
  return serializeSignature(config, placeholderAssets(config, baseUrl));
}
