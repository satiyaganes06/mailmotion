'use client';

import { LAYOUT_SPECS } from '@mailmotion/layouts';
import { getIn } from '@/lib/draft';
import { useStudioCtx } from '@/lib/useStudio';
import {
  ColorField,
  RangeField,
  Row,
  Section,
  Segmented,
  SelectField,
  TextField,
  ToggleField,
} from '../ui';
import { ListShell, useList } from './DetailsPanel';
import { ImageUpload } from './shared';

export function ExtrasPanel() {
  const s = useStudioCtx();
  const badges = useList('extras.badges', 4, () => ({ image: '', alt: '' }));
  const banner = Boolean(getIn(s.draft, ['extras', 'banner', 'enabled']));
  const kind = (getIn(s.draft, ['extras', 'banner', 'kind']) as string) ?? 'wave';
  const cta = Boolean(getIn(s.draft, ['extras', 'cta', 'enabled']));
  const logo = Boolean(getIn(s.draft, ['extras', 'logo', 'enabled']));
  const green = Boolean(getIn(s.draft, ['extras', 'greenNote']));
  const alignable = LAYOUT_SPECS[s.config.layout.id].alignable;

  return (
    <Section title="Banner, button & extras" hint="Banner, CTA, logo, badges, legal" id="extras">
      <h4 className="sub">Banner strip</h4>
      <ToggleField
        path="extras.banner.enabled"
        label="Show a banner"
        hint="Up to 460px wide, scales down on phones."
      />
      {banner && (
        <>
          <SelectField
            path="extras.banner.kind"
            label="Style"
            options={[
              { value: 'wave', label: 'Wave' },
              { value: 'ticker', label: 'Ticker' },
              { value: 'shimmer', label: 'Shimmer' },
              { value: 'static', label: 'Uploaded image' },
            ]}
          />
          {kind === 'static' ? (
            <ImageUpload
              path="extras.banner.image"
              label="banner image"
              opts={{ maxSide: 920, transparent: true }}
              hint="Best at 920 × 96 or similar (shown at 460 wide)."
            />
          ) : (
            <Row>
              <ColorField
                path="extras.banner.colorA"
                label="Colour A"
                optional
                fallback="#06b6d4"
              />
              <ColorField
                path="extras.banner.colorB"
                label="Colour B"
                optional
                fallback="#6366f1"
              />
            </Row>
          )}
          {kind !== 'static' && (
            <TextField
              path="extras.banner.text"
              label="Banner text"
              max={60}
              placeholder="Visit us at booth 12 · 3–5 Oct"
            />
          )}
          <TextField
            path="extras.banner.url"
            label="Banner link"
            type="url"
            placeholder="https://"
          />
          <RangeField
            path="extras.banner.height"
            label="Height"
            min={24}
            max={96}
            step={2}
            unit="px"
          />
        </>
      )}

      <h4 className="sub">Call-to-action button</h4>
      <ToggleField
        path="extras.cta.enabled"
        label="Show a button"
        hint="A table-based button that also works in classic Outlook."
      />
      {cta && (
        <>
          <Row>
            <TextField path="extras.cta.label" label="Label" max={30} />
            <TextField path="extras.cta.url" label="Link" type="url" placeholder="https://" />
          </Row>
          <Row>
            <ColorField
              path="extras.cta.background"
              label="Button colour"
              optional
              fallback="#b34700"
            />
            <ColorField path="extras.cta.color" label="Text colour" fallback="#ffffff" />
          </Row>
        </>
      )}

      <h4 className="sub">Company logo</h4>
      <ToggleField
        path="extras.logo.enabled"
        label="Show a company logo"
        hint="Separate from your avatar."
      />
      {logo && (
        <>
          <ImageUpload
            path="extras.logo.image"
            label="logo"
            opts={{ maxSide: 480, transparent: true }}
          />
          <Row>
            <RangeField path="extras.logo.width" label="Width" min={24} max={160} unit="px" />
            <TextField
              path="extras.logo.url"
              label="Link (optional)"
              type="url"
              placeholder="https://"
            />
          </Row>
          <ToggleField path="extras.logo.animated" label="Animate with a light sweep" />
        </>
      )}

      <h4 className="sub">Badges</h4>
      <ListShell title="Badge" list={badges} addLabel="Add badge">
        {(i) => (
          <>
            <ImageUpload
              path={`extras.badges.${i}.image`}
              label="badge"
              opts={{ maxSide: 240, transparent: true }}
            />
            <Row>
              <TextField
                path={`extras.badges.${i}.alt`}
                label="Alt text"
                max={60}
                placeholder="ISO 27001 certified"
              />
              <TextField
                path={`extras.badges.${i}.url`}
                label="Link (optional)"
                type="url"
                placeholder="https://"
              />
            </Row>
          </>
        )}
      </ListShell>

      <h4 className="sub">Small print</h4>
      <TextField
        path="extras.disclaimer"
        label="Disclaimer / legal text"
        multiline
        rows={4}
        max={800}
        hint="Counts against the 10,000-character Gmail limit."
      />
      <ToggleField path="extras.greenNote" label="Environment note" />
      {green && (
        <TextField
          path="extras.greenNoteText"
          label="Note text"
          max={120}
          placeholder="Please consider the environment before printing this email."
        />
      )}

      <h4 className="sub">Finishing</h4>
      <Row>
        <SelectField
          path="extras.divider"
          label="Divider"
          options={[
            { value: 'none', label: 'None' },
            { value: 'line', label: 'Line' },
            { value: 'dotted', label: 'Dotted' },
            { value: 'gradient', label: 'Gradient bar' },
          ]}
        />
        <SelectField
          path="extras.spacing"
          label="Spacing"
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'airy', label: 'Airy' },
          ]}
        />
      </Row>
      {alignable && (
        <Segmented
          path="extras.alignment"
          label="Alignment"
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Centred' },
          ]}
        />
      )}
      <ToggleField
        path="extras.madeWith"
        label={'Show a "Made with MailMotion" note'}
        hint="Off by default. Thanks if you keep it on."
      />
    </Section>
  );
}
