'use client';

import { LIMITS, PLATFORMS, getPlatform } from '@mailmotion/schema';
import { getIn } from '@/lib/draft';
import { useStudioCtx } from '@/lib/useStudio';
import {
  ColorField,
  Notice,
  Row,
  Section,
  Segmented,
  SelectField,
  TextField,
  ToggleField,
} from '../ui';
import { ListShell, useList } from './DetailsPanel';
import { ImageUpload } from './shared';

const HINTS: Record<string, string> = {
  linkedin: 'https://linkedin.com/in/your-name',
  github: 'https://github.com/your-name',
  x: 'https://x.com/your-handle',
  instagram: 'https://instagram.com/your-handle',
  facebook: 'https://facebook.com/your-page',
  youtube: 'https://youtube.com/@your-channel',
  tiktok: 'https://tiktok.com/@your-handle',
  threads: 'https://threads.net/@your-handle',
  bluesky: 'https://bsky.app/profile/your-name',
  whatsapp: 'https://wa.me/60123456789',
  telegram: 'https://t.me/your-name',
  calendly: 'https://calendly.com/your-name',
};

export function SocialsPanel() {
  const s = useStudioCtx();
  const list = useList('socials.items', 24, () => ({ platform: 'linkedin', url: '' }));
  const iconColor = (getIn(s.draft, ['socials', 'iconColor']) as string) ?? 'single';
  const textLinks = Boolean(getIn(s.draft, ['socials', 'textLinks']));
  const count = list.items.length;

  return (
    <Section title="Social links" hint="Icons or text links" id="socials">
      <ListShell title="Link" list={list} addLabel="Add link">
        {(i) => {
          const platform =
            (getIn(s.draft, ['socials', 'items', i, 'platform']) as string) ?? 'website';
          return (
            <>
              <Row>
                <SelectField
                  path={`socials.items.${i}.platform`}
                  label="Platform"
                  options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
                />
                <TextField path={`socials.items.${i}.label`} label="Label (optional)" max={30} />
              </Row>
              <TextField
                path={`socials.items.${i}.url`}
                label="Link"
                type="url"
                placeholder={HINTS[platform] ?? 'https://'}
                hint={
                  getPlatform(platform)?.hosts.length
                    ? `Must be a ${getPlatform(platform)!.label} link`
                    : undefined
                }
              />
              {platform === 'custom' && (
                <ImageUpload
                  path={`socials.items.${i}.customIcon`}
                  label="icon"
                  opts={{ maxSide: 128, transparent: true }}
                  hint="A small square image works best."
                />
              )}
            </>
          );
        }}
      </ListShell>
      {count > LIMITS.recommendedSocials && (
        <Notice tone="warn">
          {count} links is a lot. More than {LIMITS.recommendedSocials} can wrap on phones and uses
          your 10,000-character budget.
        </Notice>
      )}

      <ToggleField
        path="socials.textLinks"
        label="Use text links instead of icons"
        hint="Works even when images are blocked."
      />
      {!textLinks && (
        <>
          <Segmented
            path="socials.iconStyle"
            label="Icon style"
            options={[
              { value: 'circle', label: 'Circle' },
              { value: 'square', label: 'Square' },
              { value: 'filled', label: 'Filled' },
              { value: 'outline', label: 'Outline' },
            ]}
          />
          <Segmented
            path="socials.iconColor"
            label="Icon colour"
            options={[
              { value: 'single', label: 'Single colour' },
              { value: 'brand', label: 'Brand colours' },
            ]}
          />
          {iconColor === 'single' && (
            <ColorField
              path="socials.singleColor"
              label="Icon colour"
              optional
              fallback="#b34700"
              hint="Auto uses your accent."
            />
          )}
          <Row>
            <SelectField
              path="socials.iconSize"
              label="Icon size"
              hint="Tap targets stay 32px high on phones."
              options={[
                { value: 16, label: '16 px' },
                { value: 20, label: '20 px' },
                { value: 24, label: '24 px' },
                { value: 32, label: '32 px' },
              ]}
            />
            <SelectField
              path="socials.spacing"
              label="Spacing"
              options={[
                { value: 'tight', label: 'Tight' },
                { value: 'normal', label: 'Normal' },
                { value: 'wide', label: 'Wide' },
              ]}
            />
          </Row>
        </>
      )}
      <SelectField
        path="socials.position"
        label="Position"
        options={[
          { value: 'below', label: 'Below the details' },
          { value: 'beside', label: 'Beside the name' },
          { value: 'row', label: 'Separate row' },
        ]}
      />
    </Section>
  );
}
