'use client';

import {
  AVATAR_ANIMATIONS,
  LAYOUT_IDS,
  MARK_ANIMATIONS,
  type AvatarAnimationId,
  type LayoutId,
  type MarkAnimationId,
  type PaletteId,
  type PresetId,
  type SectionKey,
} from '@mailmotion/schema';
import { LAYOUT_SPECS } from '@mailmotion/layouts';
import { PALETTE_LIST, PRESET_LIST, applyPreset, remix } from '@mailmotion/presets';
import { useStudioCtx } from '@/lib/useStudio';
import type { Draft } from '@/lib/draft';
import { Row, Section, Segmented, ToggleField } from '../ui';

const AV_LABEL: Record<AvatarAnimationId, string> = {
  aurora: 'Aurora ring',
  'strip-reveal': 'Strip reveal',
  pulse: 'Pulse ring',
  neon: 'Neon glow',
  orbit: 'Orbit ring',
  equalizer: 'Equalizer',
  none: 'None (static)',
};
const MARK_LABEL: Record<MarkAnimationId, string> = {
  ink: 'Ink draw',
  fade: 'Fade in',
  none: 'None (static)',
};

const SECTION_LABELS: Record<SectionKey, string> = {
  avatar: 'Avatar',
  mark: 'Signature mark',
  social: 'Social row',
  banner: 'Banner',
  cta: 'Call-to-action',
  disclaimer: 'Disclaimer',
  badges: 'Badges',
  logo: 'Company logo',
};

export function DesignPanel() {
  const s = useStudioCtx();
  const { config } = s;

  const surprise = () => {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
    const preset = pick(PRESET_LIST);
    let c = applyPreset(config, preset.id);
    const palette = pick(PALETTE_LIST);
    c = remix(c, {
      palette: palette.id,
      layout: Math.random() < 0.3 ? pick(LAYOUT_IDS) : undefined,
      avatarAnimation: Math.random() < 0.4 ? pick(AVATAR_ANIMATIONS) : undefined,
    });
    s.replace(c as unknown as Draft);
  };

  return (
    <Section title="Design & layout" hint="Six designs, remix any part" defaultOpen id="design">
      <div className="presets" role="radiogroup" aria-label="Design">
        {PRESET_LIST.map((p) => {
          const on = config.presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`preset${on ? ' on' : ''}`}
              onClick={() => s.replace(applyPreset(config, p.id as PresetId) as unknown as Draft)}
            >
              <span className="dots" aria-hidden="true">
                <i style={{ background: p.patch.theme.accent }} />
                <i style={{ background: p.patch.theme.secondary }} />
              </span>
              <strong>{p.name}</strong>
              <small>{p.bestFor}</small>
            </button>
          );
        })}
      </div>
      <div className="row-actions">
        <button type="button" className="btn small" onClick={surprise}>
          ✦ Surprise me
        </button>
      </div>

      <h4 className="sub">Remix</h4>
      <Row>
        <div className="field">
          <label htmlFor="rx-layout">Layout</label>
          <select
            id="rx-layout"
            value={config.layout.id}
            onChange={(e) =>
              s.replace(remix(config, { layout: e.target.value as LayoutId }) as unknown as Draft)
            }
          >
            {LAYOUT_IDS.map((id) => (
              <option key={id} value={id}>
                {LAYOUT_SPECS[id].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rx-av">Avatar animation</label>
          <select
            id="rx-av"
            value={config.avatar.animation}
            onChange={(e) =>
              s.replace(
                remix(config, {
                  avatarAnimation: e.target.value as AvatarAnimationId,
                }) as unknown as Draft,
              )
            }
          >
            {AVATAR_ANIMATIONS.map((id) => (
              <option key={id} value={id}>
                {AV_LABEL[id]}
              </option>
            ))}
          </select>
        </div>
      </Row>
      <div className="field">
        <label htmlFor="rx-mark">Signature mark animation</label>
        <select
          id="rx-mark"
          value={config.mark.animation}
          onChange={(e) =>
            s.replace(
              remix(config, {
                markAnimation: e.target.value as MarkAnimationId,
              }) as unknown as Draft,
            )
          }
        >
          {MARK_ANIMATIONS.map((id) => (
            <option key={id} value={id}>
              {MARK_LABEL[id]}
            </option>
          ))}
        </select>
      </div>
      <p className="field-hint">{LAYOUT_SPECS[config.layout.id].description}</p>

      <h4 className="sub">Palette</h4>
      <div className="palettes" role="radiogroup" aria-label="Palette">
        {PALETTE_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={config.theme.palette === p.id}
            aria-label={p.name}
            title={p.name}
            className={`swatch${config.theme.palette === p.id ? ' on' : ''}`}
            style={{ background: `linear-gradient(135deg, ${p.accent} 50%, ${p.secondary} 50%)` }}
            onClick={() =>
              s.replace(remix(config, { palette: p.id as PaletteId }) as unknown as Draft)
            }
          />
        ))}
      </div>

      <h4 className="sub">Size & versions</h4>
      <Segmented
        path="layout.width"
        label="Width"
        hint="Mobile-safe keeps the main block within 400px. Wide allows 600px."
        options={[
          { value: 'mobile', label: 'Mobile-safe (400px)' },
          { value: 'wide', label: 'Wide (600px)' },
        ]}
      />
      <Segmented
        path="layout.variant"
        label="Version"
        hint="Reply is compact (no banner or mark). Save different versions of one signature."
        options={[
          { value: 'full', label: 'Full' },
          { value: 'reply', label: 'Reply' },
          { value: 'mobile', label: 'Mobile' },
        ]}
      />
      <details className="mini">
        <summary>Show or hide sections</summary>
        <div className="toggles">
          {(Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => (
            <ToggleField key={k} path={`layout.sections.${k}`} label={SECTION_LABELS[k]} />
          ))}
        </div>
      </details>
    </Section>
  );
}
