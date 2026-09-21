import {
  siApplepodcasts,
  siBehance,
  siBluesky,
  siCalendly,
  siDiscord,
  siDribbble,
  siFacebook,
  siGithub,
  siInstagram,
  siMastodon,
  siMedium,
  siSpotify,
  siSubstack,
  siTelegram,
  siThreads,
  siTiktok,
  siWhatsapp,
  siX,
  siXing,
  siYoutube,
} from 'simple-icons';
import type { PlatformId } from '@mailmotion/schema';

/** A drawable piece of an icon in a 24x24 box. */
export interface Glyph {
  d: string;
  /** `fill` for solid logos; `stroke` for line icons drawn with the style's line width. */
  mode: 'fill' | 'stroke';
}

const fill = (d: string): Glyph[] => [{ d, mode: 'fill' }];

// Simple Icons (CC0) no longer ships LinkedIn, so it is drawn here.
const LINKEDIN =
  'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z';

export const GLYPHS: Record<PlatformId, Glyph[]> = {
  website: [
    { d: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', mode: 'stroke' },
    { d: 'M3 12h18', mode: 'stroke' },
    {
      d: 'M12 3c2.8 2.6 4.2 5.8 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.8-4.2-9s1.4-6.4 4.2-9z',
      mode: 'stroke',
    },
  ],
  custom: [
    { d: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1', mode: 'stroke' },
    { d: 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1', mode: 'stroke' },
  ],
  linkedin: fill(LINKEDIN),
  github: fill(siGithub.path),
  x: fill(siX.path),
  instagram: fill(siInstagram.path),
  facebook: fill(siFacebook.path),
  youtube: fill(siYoutube.path),
  tiktok: fill(siTiktok.path),
  threads: fill(siThreads.path),
  bluesky: fill(siBluesky.path),
  mastodon: fill(siMastodon.path),
  behance: fill(siBehance.path),
  dribbble: fill(siDribbble.path),
  medium: fill(siMedium.path),
  substack: fill(siSubstack.path),
  whatsapp: fill(siWhatsapp.path),
  telegram: fill(siTelegram.path),
  discord: fill(siDiscord.path),
  calendly: fill(siCalendly.path),
  spotify: fill(siSpotify.path),
  applepodcasts: fill(siApplepodcasts.path),
  xing: fill(siXing.path),
};
