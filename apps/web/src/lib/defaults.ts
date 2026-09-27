import { createFromPreset } from '@mailmotion/presets';
import type { PresetId } from '@mailmotion/schema';
import type { Draft } from './draft';

export const SAMPLE = {
  fullName: 'Shatthiya Ganes',
  title: 'Mobile Security Engineer',
  company: 'Vigilant Asia',
  email: 'satiyaganes.sg@gmail.com',
  websites: [{ url: 'https://www.satiyaganes.site' }],
  phones: [{ label: 'Mobile', number: '+60 1163348685' }],
} as const;

/** The state a first-time visitor starts from: a good-looking sample they can overwrite. */
export function defaultDraft(preset: PresetId = 'aurora'): Draft {
  const base = createFromPreset(preset, {
    ...SAMPLE,
    phones: [...SAMPLE.phones],
    websites: [...SAMPLE.websites],
  });
  return {
    ...(base as unknown as Draft),
    socials: {
      ...(base.socials as object),
      items: [
        { platform: 'website', url: 'https://www.satiyaganes.site' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/in/satiya-ganes-b0a315209' },
        { platform: 'github', url: 'https://github.com/satiyaganes06' },
      ],
    },
  };
}
