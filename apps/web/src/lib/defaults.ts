import { createFromPreset } from '@mailmotion/presets';
import type { PresetId } from '@mailmotion/schema';
import type { Draft } from './draft';

export const SAMPLE = {
  fullName: 'Alex Morgan',
  title: 'Product Designer',
  company: 'Northwind Studio',
  email: 'alex@example.com',
  websites: [{ url: 'https://example.com' }],
  phones: [{ label: 'Mobile', number: '+1 415 555 0134' }],
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
        { platform: 'website', url: 'https://example.com' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/example' },
        { platform: 'github', url: 'https://github.com/example' },
      ],
    },
  };
}
