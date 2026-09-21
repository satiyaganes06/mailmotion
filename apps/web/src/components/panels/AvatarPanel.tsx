'use client';

import { useState } from 'react';
import { removeBackground } from '@mailmotion/renderer';
import { getIn } from '@/lib/draft';
import { useStudioCtx } from '@/lib/useStudio';
import { Notice, RangeField, Row, Section, SelectField, Segmented, TextField } from '../ui';
import { ImageUpload, PaintField } from './shared';

const ANIMS = [
  { value: 'aurora', label: 'Aurora ring' },
  { value: 'strip-reveal', label: 'Strip reveal' },
  { value: 'pulse', label: 'Pulse ring' },
  { value: 'neon', label: 'Neon glow' },
  { value: 'orbit', label: 'Orbit ring' },
  { value: 'equalizer', label: 'Equalizer' },
  { value: 'none', label: 'None (static)' },
] as const;

/** Remove a plain background from the current photo, entirely in the browser. */
async function stripBackground(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const res = removeBackground({ canvas, ctx } as never);
  if (res.removedRatio < 0.02)
    throw new Error(
      'No plain background was found to remove. This works best on photos with an even background.',
    );
  return canvas.toDataURL('image/png');
}

export function AvatarPanel() {
  const s = useStudioCtx();
  const source = (getIn(s.draft, ['avatar', 'source']) as string) ?? 'initials';
  const image = getIn(s.draft, ['avatar', 'image']) as string | undefined;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'good'; text: string } | null>(null);

  const removeBg = async () => {
    if (!image) return;
    setBusy(true);
    setMsg(null);
    try {
      s.set('avatar.image', await stripBackground(image));
      setMsg({
        tone: 'good',
        text: 'Background removed. Undo (Ctrl/Cmd+Z) restores the original.',
      });
    } catch (e) {
      setMsg({
        tone: 'bad',
        text: e instanceof Error ? e.message : 'Could not remove the background.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Avatar" hint="Photo, initials or logo" id="avatar">
      <Segmented
        path="avatar.source"
        label="Source"
        options={[
          { value: 'initials', label: 'Initials' },
          { value: 'photo', label: 'Photo' },
          { value: 'logo', label: 'Logo' },
        ]}
      />
      {source === 'initials' ? (
        <TextField
          path="avatar.initials"
          label="Initials"
          max={3}
          placeholder="Auto from your name"
        />
      ) : (
        <>
          <ImageUpload
            path="avatar.image"
            label={source === 'logo' ? 'logo' : 'photo'}
            opts={{ maxSide: 512, transparent: source === 'logo' }}
            hint="Processed in your browser. Location and camera data are stripped."
          />
          {image && source === 'photo' && (
            <div className="row-actions">
              <button type="button" className="btn small" onClick={removeBg} disabled={busy}>
                {busy ? 'Working…' : 'Remove plain background'}
              </button>
            </div>
          )}
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          {image && source === 'photo' && (
            <>
              <h4 className="sub">Crop</h4>
              <RangeField
                path="avatar.crop.zoom"
                label="Zoom"
                min={1}
                max={4}
                step={0.05}
                unit="×"
              />
              <Row>
                <RangeField
                  path="avatar.crop.x"
                  label="Left / right"
                  min={-1}
                  max={1}
                  step={0.02}
                />
                <RangeField path="avatar.crop.y" label="Up / down" min={-1} max={1} step={0.02} />
              </Row>
              <RangeField
                path="avatar.crop.rotate"
                label="Rotate"
                min={-180}
                max={180}
                step={1}
                unit="°"
              />
              <Segmented
                path="avatar.filter"
                label="Filter"
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'greyscale', label: 'Greyscale' },
                  { value: 'duotone', label: 'Duotone' },
                ]}
              />
            </>
          )}
        </>
      )}

      <h4 className="sub">Style</h4>
      <Segmented
        path="avatar.shape"
        label="Shape"
        hint="Baked into the image: Outlook ignores rounded corners."
        options={[
          { value: 'circle', label: 'Circle' },
          { value: 'rounded', label: 'Rounded' },
          { value: 'square', label: 'Square' },
          { value: 'squircle', label: 'Squircle' },
        ]}
      />
      <Segmented
        path="avatar.size"
        label="Size"
        options={[
          { value: 'S', label: 'S · 64' },
          { value: 'M', label: 'M · 80' },
          { value: 'L', label: 'L · 96' },
        ]}
      />
      <SelectField
        path="avatar.animation"
        label="Animation"
        hint="Frame 1 is always the complete avatar."
        options={ANIMS}
      />
      <Segmented
        path="avatar.speed"
        label="Speed"
        hint="Always 12 fps or slower; flashing stays below 3 per second."
        options={[
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ]}
      />
      <PaintField
        path="avatar.ring"
        label="Ring / border colour"
        fallbackA="#b34700"
        fallbackB="#e2793d"
      />
    </Section>
  );
}
