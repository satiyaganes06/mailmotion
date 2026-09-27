import { createFromSimplePreset } from '@mailmotion/presets';
import type { SimplePresetId } from '@mailmotion/schema';
import type { Draft } from './draft';

/** Sample details for a first-time Simple Style visitor (matches the source Signet demo). */
export const SIMPLE_SAMPLE = {
  fullName: 'Aina Rahman',
  title: 'Product Designer',
  company: 'Lumen Labs',
  email: 'aina@lumenlabs.io',
  websites: [{ url: 'https://lumenlabs.io' }],
  phones: [{ label: '', number: '+60 12 345 6789' }],
  tagline: 'Designing calmer fintech apps',
} as const;

/** The state a first-time Simple Style visitor starts from. */
export function simpleDefaultDraft(preset: SimplePresetId = 'simple-aurora'): Draft {
  const base = createFromSimplePreset(preset, {
    ...SIMPLE_SAMPLE,
    phones: [...SIMPLE_SAMPLE.phones],
    websites: [...SIMPLE_SAMPLE.websites],
  });
  return base as unknown as Draft;
}
