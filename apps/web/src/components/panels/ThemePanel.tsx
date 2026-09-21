'use client';

import { getIn } from '@/lib/draft';
import { useStudioCtx } from '@/lib/useStudio';
import { ColorField, RangeField, Row, Section, Segmented, SelectField, ToggleField } from '../ui';

export function ThemePanel() {
  const s = useStudioCtx();
  const bg = getIn(s.draft, ['theme', 'background']);
  const bgMode = typeof bg === 'object' && bg ? 'color' : ((bg as string) ?? 'transparent');

  return (
    <Section title="Colours & theme" hint="Accent, text, background" id="theme">
      <Row>
        <ColorField path="theme.accent" label="Accent" hint="Links and highlights" />
        <ColorField
          path="theme.secondary"
          label="Secondary"
          hint="Gradients and rings"
          optional
          fallback="#e2793d"
        />
      </Row>
      <h4 className="sub">Text colours</h4>
      <Row cols={3}>
        <ColorField path="theme.textColors.name" label="Name" fallback="#1c1b19" />
        <ColorField path="theme.textColors.title" label="Title" fallback="#57534e" />
        <ColorField path="theme.textColors.body" label="Body" fallback="#57534e" />
      </Row>
      <p className="field-hint">
        Colours are checked for 4.5:1 contrast on the signature background and fixed automatically
        if they fail.
      </p>

      <div className="field">
        <span className="lbl">Background</span>
        <div className="segmented" role="radiogroup" aria-label="Background">
          {[
            { v: 'transparent', l: 'Transparent' },
            { v: 'white', l: 'White' },
            { v: 'color', l: 'Colour card' },
          ].map((o) => (
            <label key={o.v} className={bgMode === o.v ? 'on' : ''}>
              <input
                type="radio"
                name="bg-mode"
                checked={bgMode === o.v}
                onChange={() =>
                  s.set('theme.background', o.v === 'color' ? { color: '#fef3c7' } : o.v)
                }
              />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">
          Transparent is the safest choice. Coloured cards are contrast-checked in dark mode too.
        </p>
      </div>
      {bgMode === 'color' && (
        <ColorField path="theme.background.color" label="Card colour" fallback="#fef3c7" />
      )}

      <Segmented
        path="theme.darkMode"
        label="Dark mode"
        hint="Clients invert colours themselves. 'Dark variant' bakes light text for people who always read on dark."
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'force-dark-variant', label: 'Dark variant' },
        ]}
      />

      <h4 className="sub">Typography</h4>
      <SelectField
        path="typography.fontFamily"
        label="Font"
        hint="Only fonts every email client has. Web fonts do not load in Gmail or Outlook."
        options={[
          { value: 'arial', label: 'Arial / Helvetica' },
          { value: 'georgia', label: 'Georgia' },
          { value: 'verdana', label: 'Verdana' },
          { value: 'tahoma', label: 'Tahoma' },
          { value: 'trebuchet', label: 'Trebuchet MS' },
          { value: 'times', label: 'Times New Roman' },
        ]}
      />
      <Row>
        <RangeField path="typography.nameSize" label="Name size" min={14} max={24} unit="px" />
        <RangeField
          path="typography.bodySize"
          label="Body size"
          min={12}
          max={15}
          unit="px"
          hint="12px minimum (iOS enlarges smaller text)."
        />
      </Row>
      <Segmented
        path="typography.nameWeight"
        label="Name weight"
        options={[
          { value: 'bold', label: 'Bold' },
          { value: 'regular', label: 'Regular' },
        ]}
      />
      <Row>
        <SelectField
          path="typography.nameCase"
          label="Name case"
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'upper', label: 'UPPERCASE' },
            { value: 'smallcaps', label: 'Small caps' },
          ]}
        />
        <SelectField
          path="typography.titleCase"
          label="Title case"
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'upper', label: 'UPPERCASE' },
            { value: 'smallcaps', label: 'Small caps' },
          ]}
        />
      </Row>
      <Row>
        <SelectField
          path="typography.letterSpacing"
          label="Letter spacing"
          options={[
            { value: 'tight', label: 'Tight' },
            { value: 'normal', label: 'Normal' },
            { value: 'wide', label: 'Wide' },
          ]}
        />
        <SelectField
          path="typography.lineHeight"
          label="Line height"
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'relaxed', label: 'Relaxed' },
          ]}
        />
      </Row>
      <ToggleField
        path="typography.displayName"
        label="Bake the name into an image"
        hint="Uses your handwriting font. Alt text keeps the name accessible."
      />
    </Section>
  );
}
