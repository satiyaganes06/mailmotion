import { toHttpsUrl } from './validate';

export interface PlatformInfo {
  id: string;
  label: string;
  /** Allowed hostnames (suffix match, e.g. `linkedin.com` matches `www.linkedin.com`). Empty = any https host. */
  hosts: readonly string[];
  /** Brand colour used for coloured icons. */
  brand: string;
}

export const PLATFORMS = [
  { id: 'website', label: 'Website', hosts: [], brand: '#475569' },
  { id: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com', 'lnkd.in'], brand: '#0a66c2' },
  { id: 'github', label: 'GitHub', hosts: ['github.com'], brand: '#181717' },
  { id: 'x', label: 'X', hosts: ['x.com', 'twitter.com'], brand: '#000000' },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'], brand: '#e4405f' },
  { id: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'], brand: '#1877f2' },
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], brand: '#ff0000' },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], brand: '#000000' },
  { id: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'], brand: '#000000' },
  { id: 'bluesky', label: 'Bluesky', hosts: ['bsky.app'], brand: '#0085ff' },
  { id: 'mastodon', label: 'Mastodon', hosts: [], brand: '#6364ff' },
  { id: 'behance', label: 'Behance', hosts: ['behance.net'], brand: '#1769ff' },
  { id: 'dribbble', label: 'Dribbble', hosts: ['dribbble.com'], brand: '#ea4c89' },
  { id: 'medium', label: 'Medium', hosts: ['medium.com'], brand: '#000000' },
  { id: 'substack', label: 'Substack', hosts: [], brand: '#ff6719' },
  { id: 'whatsapp', label: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'], brand: '#25d366' },
  { id: 'telegram', label: 'Telegram', hosts: ['t.me', 'telegram.me'], brand: '#26a5e4' },
  { id: 'discord', label: 'Discord', hosts: ['discord.gg', 'discord.com'], brand: '#5865f2' },
  { id: 'calendly', label: 'Calendly', hosts: ['calendly.com'], brand: '#006bff' },
  { id: 'spotify', label: 'Spotify', hosts: ['spotify.com'], brand: '#1db954' },
  { id: 'applepodcasts', label: 'Apple Podcasts', hosts: ['podcasts.apple.com'], brand: '#9933cc' },
  { id: 'xing', label: 'Xing', hosts: ['xing.com'], brand: '#006567' },
  { id: 'custom', label: 'Custom link', hosts: [], brand: '#475569' },
] as const satisfies readonly PlatformInfo[];

export type PlatformId = (typeof PLATFORMS)[number]['id'];
export const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as [PlatformId, ...PlatformId[]];

export function getPlatform(id: string): PlatformInfo | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/** Validate a profile URL for a platform. Returns the normalised href, or an error message. */
export function validateSocialUrl(
  platform: string,
  url: string,
): { ok: true; href: string } | { ok: false; error: string } {
  const href = toHttpsUrl(url);
  if (!href) return { ok: false, error: 'Must be a valid https:// link' };
  const info = getPlatform(platform);
  if (!info) return { ok: false, error: 'Unknown platform' };
  if (info.hosts.length === 0) return { ok: true, href };
  const host = new URL(href).hostname.toLowerCase();
  const match = info.hosts.some((h) => host === h || host.endsWith(`.${h}`));
  return match ? { ok: true, href } : { ok: false, error: `Expected a ${info.label} link` };
}
