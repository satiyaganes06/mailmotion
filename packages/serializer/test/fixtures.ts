import { createFromPreset } from '@mailmotion/presets';
import {
  createConfig,
  type PresetId,
  type SignatureConfig,
  type SignatureConfigInput,
} from '@mailmotion/schema';

export const SAMPLE_DETAILS: SignatureConfigInput['details'] = {
  fullName: 'Shatthiya Ganes',
  pronouns: 'he/him',
  title: 'Mobile Security Engineer',
  company: 'Vigilant Asia',
  companyUrl: 'https://vigilantasia.com',
  phones: [{ label: 'Mobile', number: '+60 12-345 6789' }],
  email: 'ganes@vigilantasia.com',
  websites: [{ url: 'https://shatthiyaganes.com' }],
};

export const SAMPLE_SOCIALS: SignatureConfigInput['socials'] = {
  items: [
    { platform: 'website', url: 'https://shatthiyaganes.com' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/shatthiya-ganes' },
    { platform: 'github', url: 'https://github.com/shatthiyaganes' },
    { platform: 'x', url: 'https://x.com/shatthiyaganes' },
    { platform: 'instagram', url: 'https://instagram.com/shatthiyaganes' },
    { platform: 'facebook', url: 'https://facebook.com/shatthiyaganes' },
    { platform: 'whatsapp', url: 'https://wa.me/60123456789' },
  ],
};

export function sampleFor(id: PresetId): SignatureConfig {
  const base = createFromPreset(id, SAMPLE_DETAILS);
  return createConfig({ ...base, socials: SAMPLE_SOCIALS } as SignatureConfigInput);
}

export const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
