import { zipSync, strToU8 } from 'fflate';
import type { SignatureConfig } from '@mailmotion/schema';
import { exportConfig } from '@mailmotion/schema';
import { fileBaseName, serializeSignature, toHtmDocument } from '@mailmotion/serializer';
import { toSignatureAssets, uniqueFiles, type RenderedAsset } from './render';

export const PLACEHOLDER_BASE = 'https://your-host.example/mailmotion';

export function readmeText(baseUrl: string, files: string[]): string {
  return `MailMotion signature bundle
===========================

1. Upload every image in the images/ folder to one public https location
   (your website, Netlify Drop, Cloudflare Pages, S3, GitHub Pages...).
   Keep the file names exactly as they are.
2. The signature.html in this bundle points at:
     ${baseUrl}/<file name>
   If your images live somewhere else, open MailMotion, choose "Download ZIP" > "Set base URL",
   or run:   npx mailmotion render signature.mailmotion.json --base-url https://your-host/path
3. Copy signature.html into your mail client (Gmail: Settings > Signature; Outlook: Signatures).

Why hosted images? Gmail and Outlook do not show images embedded in the message or signature.
Files are named by content hash, so an edited signature never collides with an old one, and
emails you already sent keep working as long as the old files stay online.

Files (${files.length}):
${files.map((f) => `  images/${f}`).join('\n')}

signature.mailmotion.json contains your design so you can edit it later or move it between
the self-hosted and cloud versions.
`;
}

export interface Bundle {
  /** The zip file. */
  zip: Uint8Array;
  html: string;
  files: string[];
}

/** Everything needed to host a signature yourself: images, HTML, portable config and instructions. */
export function buildBundle(
  config: SignatureConfig,
  rendered: RenderedAsset[],
  opts: { baseUrl?: string } = {},
): Bundle {
  const baseUrl = (opts.baseUrl ?? PLACEHOLDER_BASE).replace(/\/+$/, '');
  const unique = uniqueFiles(rendered);
  const { html } = serializeSignature(config, toSignatureAssets(rendered, baseUrl));
  const entries: Record<string, Uint8Array> = {
    'signature.html': strToU8(toHtmDocument(html, config.name ?? config.details.fullName)),
    'signature.mailmotion.json': strToU8(exportConfig(config)),
    'README.txt': strToU8(readmeText(baseUrl, [...unique.keys()])),
  };
  for (const [name, r] of unique) entries[`images/${name}`] = r.bytes;
  return { zip: zipSync(entries, { level: 0 }), html, files: [...unique.keys()] };
}

export { fileBaseName };
