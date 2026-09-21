'use client';

import { useId, useState } from 'react';
import type { Paint } from '@mailmotion/schema';
import { ACCEPT, ImageError, loadImageFile, type LoadOptions } from '@/lib/imageio';
import { useField, useStudioCtx } from '@/lib/useStudio';
import { Field, FileButton, Notice } from '../ui';

/** Upload → downscale → strip metadata → store as a data URL at `path`. */
export function ImageUpload({
  path,
  label,
  opts,
  hint,
  clearLabel = 'Remove',
}: {
  path: string;
  label: string;
  opts: LoadOptions;
  hint?: string;
  clearLabel?: string;
}) {
  const f = useField<string>(path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = typeof f.value === 'string' && f.value.length > 0;

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      f.set(await loadImageFile(file, opts));
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'That image could not be used.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload">
      <div className="upload-row">
        {has ? (
          <img className="thumb" src={f.value} alt="" width={44} height={44} />
        ) : (
          <span className="thumb empty" aria-hidden="true" />
        )}
        <div className="upload-actions">
          <FileButton
            label={
              busy
                ? 'Processing…'
                : has
                  ? `Replace ${label.toLowerCase()}`
                  : `Upload ${label.toLowerCase()}`
            }
            accept={ACCEPT}
            onFile={onFile}
            disabled={busy}
          />
          {has && (
            <button type="button" className="btn ghost small" onClick={() => f.set('')}>
              {clearLabel}
            </button>
          )}
        </div>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
      {error && <Notice tone="bad">{error}</Notice>}
      {f.error && <p className="field-error">{f.error}</p>}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A colour or a two-stop gradient, stored as `'#rrggbb'` or `{ from, to }`. `optional` allows "auto". */
export function PaintField({
  path,
  label,
  fallbackA,
  fallbackB,
  optional = true,
  hint,
}: {
  path: string;
  label: string;
  fallbackA: string;
  fallbackB: string;
  optional?: boolean;
  hint?: string;
}) {
  const f = useField<Paint>(path);
  const id = useId();
  const v = f.value;
  const mode: 'auto' | 'solid' | 'gradient' =
    v === undefined || v === '' ? 'auto' : typeof v === 'string' ? 'solid' : 'gradient';
  const a = typeof v === 'string' ? v : (v?.from ?? fallbackA);
  const b = typeof v === 'object' && v ? v.to : fallbackB;
  const pick = (c: string) => (HEX.test(c) ? c : fallbackA);

  const setMode = (m: string) => {
    if (m === 'auto') f.set('');
    else if (m === 'solid') f.set(pick(a));
    else f.set({ from: pick(a), to: pick(b) });
  };

  return (
    <Field label={label} hint={hint} error={f.error} htmlFor={id}>
      <div className="paint">
        <select
          id={id}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          aria-label={`${label} style`}
        >
          {optional && <option value="auto">Auto (accent)</option>}
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
        {mode !== 'auto' && (
          <input
            type="color"
            aria-label={`${label} colour ${mode === 'gradient' ? 'start' : ''}`}
            value={pick(a)}
            onChange={(e) =>
              f.set(mode === 'solid' ? e.target.value : { from: e.target.value, to: pick(b) })
            }
          />
        )}
        {mode === 'gradient' && (
          <input
            type="color"
            aria-label={`${label} colour end`}
            value={pick(b)}
            onChange={(e) => f.set({ from: pick(a), to: e.target.value })}
          />
        )}
      </div>
    </Field>
  );
}

/** Convenience: which layout/section context the studio config is in. */
export function useConfig() {
  return useStudioCtx().config;
}
