import { planAssets, type SignatureAssets } from '@mailmotion/layouts';
import { resolveVariant, type SignatureConfig } from '@mailmotion/schema';
import type { RenderEnv } from './env';
import {
  renderAvatar,
  renderBadge,
  renderBanner,
  renderDisplayName,
  renderDivider,
  renderLogo,
  renderMark,
  renderSocialIcon,
  type RenderedAsset,
} from './slots';

export type { RenderedAsset };

export interface RenderOptions {
  onProgress?: (done: number, total: number, slotId: string) => void;
}

/** Render every image the signature needs (see `planAssets`). Deterministic for a given config. */
export async function renderSignatureAssets(
  config: SignatureConfig,
  env: RenderEnv,
  opts: RenderOptions = {},
): Promise<RenderedAsset[]> {
  const cfg = resolveVariant(config);
  const plan = planAssets(config);
  const out: RenderedAsset[] = [];
  let done = 0;
  for (const slot of plan) {
    switch (slot.kind) {
      case 'avatar':
        out.push(await renderAvatar(env, cfg, slot));
        break;
      case 'mark':
        out.push(await renderMark(env, cfg, slot));
        break;
      case 'displayName':
        out.push(await renderDisplayName(env, cfg, slot));
        break;
      case 'banner':
        out.push(await renderBanner(env, cfg, slot));
        break;
      case 'logo':
        out.push(await renderLogo(env, cfg, slot));
        break;
      case 'icon':
        out.push(await renderSocialIcon(env, cfg, slot));
        break;
      case 'badge':
        out.push(await renderBadge(env, cfg, slot));
        break;
      case 'divider':
        out.push(await renderDivider(env, cfg, slot));
        break;
    }
    opts.onProgress?.(++done, plan.length, slot.id);
  }
  return out;
}

/** Map rendered files to the URLs they will be served from. */
export function toSignatureAssets(rendered: RenderedAsset[], baseUrl: string): SignatureAssets {
  const base = baseUrl.replace(/\/+$/, '');
  const slots: SignatureAssets['slots'] = {};
  for (const r of rendered)
    slots[r.slotId] = { url: `${base}/${r.fileName}`, width: r.width, height: r.height };
  return { slots };
}

/** Identical files (e.g. two equal icons) are stored once. */
export function uniqueFiles(rendered: RenderedAsset[]): Map<string, RenderedAsset> {
  const files = new Map<string, RenderedAsset>();
  for (const r of rendered) if (!files.has(r.fileName)) files.set(r.fileName, r);
  return files;
}
