'use client';

import { SIMPLE_PRESET_LIST, applySimplePreset, getSimplePreset } from '@mailmotion/presets';
import type { SimplePresetId } from '@mailmotion/schema';
import type { Draft } from '@/lib/draft';
import { useStudioCtx } from '@/lib/useStudio';
import { ColorField, Section, TextField } from '../ui';

/** The active design's Simple-Style id, or a sensible fallback if the draft came from Custom Style. */
function activeSimpleId(presetId: string | undefined): SimplePresetId {
  return SIMPLE_PRESET_LIST.some((p) => p.id === presetId)
    ? (presetId as SimplePresetId)
    : 'simple-aurora';
}

/**
 * Simple Style's entire editor: ten designs, one accent colour, and only the fields the active
 * design actually uses (see `SimplePresetDef.fields` in @mailmotion/presets). No socials, no
 * banner/CTA/badge editor, no palette — Custom Style still has all of that.
 */
export function SimplePanel() {
  const s = useStudioCtx();
  const { config } = s;
  const activeId = activeSimpleId(config.presetId);
  const active = getSimplePreset(activeId);

  return (
    <Section title="Design" hint="Ten designs, one colour" defaultOpen id="simple-design">
      <div className="presets" role="radiogroup" aria-label="Design">
        {SIMPLE_PRESET_LIST.map((p) => {
          const on = activeId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`preset${on ? ' on' : ''}`}
              onClick={() =>
                s.replace(applySimplePreset(config, p.id as SimplePresetId) as unknown as Draft)
              }
            >
              <span className="dots" aria-hidden="true">
                <i style={{ background: config.theme.accent }} />
              </span>
              <strong>{p.name}</strong>
              <small>{p.bestFor}</small>
            </button>
          );
        })}
      </div>

      <h4 className="sub">Colour</h4>
      <ColorField path="theme.accent" label="Accent" hint="Every design uses this one colour" />

      <h4 className="sub">Your details</h4>
      <TextField path="details.fullName" label="Full name" max={60} />
      <TextField path="details.title" label="Job title" max={80} />
      {active.fields.company && <TextField path="details.company" label="Company" max={80} />}
      {active.fields.phone && (
        <TextField path="details.phones.0.number" label="Phone" type="tel" max={30} />
      )}
      {active.fields.email && (
        <TextField path="details.email" label="Email" type="email" max={120} />
      )}
      {active.fields.website && (
        <TextField path="details.websites.0.url" label="Website" type="url" max={200} />
      )}
      {active.fields.tagline && (
        <TextField
          path="details.tagline"
          label="Tagline"
          max={90}
          hint="What you're typing out or announcing"
        />
      )}
      {active.fields.status && (
        <TextField
          path="details.tagline"
          label="Status line"
          max={90}
          hint="e.g. “Available for calls this week”"
        />
      )}
    </Section>
  );
}
