import { createFromPreset } from '@mailmotion/presets';
import {
  createConfig,
  type PresetId,
  type SignatureConfig,
  type SignatureConfigInput,
} from '@mailmotion/schema';

export const SAMPLE_DETAILS: SignatureConfigInput['details'] = {
  fullName: 'Jordan Rivera',
  pronouns: 'they/them',
  title: 'Product Manager',
  company: 'Example Corp',
  companyUrl: 'https://example.com',
  phones: [{ label: 'Mobile', number: '+1 415-555 0142' }],
  email: 'jordan@example.com',
  websites: [{ url: 'https://example.com' }],
};

export const SAMPLE_SOCIALS: SignatureConfigInput['socials'] = {
  items: [
    { platform: 'website', url: 'https://example.com' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/example' },
    { platform: 'github', url: 'https://github.com/example' },
    { platform: 'x', url: 'https://x.com/example' },
    { platform: 'instagram', url: 'https://instagram.com/example' },
    { platform: 'facebook', url: 'https://facebook.com/example' },
    { platform: 'whatsapp', url: 'https://wa.me/15555550123' },
  ],
};

export function sampleFor(id: PresetId): SignatureConfig {
  const base = createFromPreset(id, SAMPLE_DETAILS);
  return createConfig({ ...base, socials: SAMPLE_SOCIALS } as SignatureConfigInput);
}

export const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
