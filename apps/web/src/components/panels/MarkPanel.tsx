'use client';

import { useEffect, useRef, useState } from 'react';
import { INK_FONTS, normalizeStrokes, vectorizeSignature } from '@mailmotion/ink';
import type { Stroke } from '@mailmotion/schema';
import { getIn } from '@/lib/draft';
import { ACCEPT, ImageError, dataUrlToRgba, loadImageFile } from '@/lib/imageio';
import { useStudioCtx } from '@/lib/useStudio';
import {
  FileButton,
  Notice,
  RangeField,
  Section,
  Segmented,
  SelectField,
  TextField,
  ToggleField,
} from '../ui';
import { PaintField } from './shared';

type Pt = [number, number];

/** A canvas you can sign on with a mouse, trackpad, finger or stylus. */
function SignaturePad({
  onChange,
}: {
  onChange: (m: { strokes: Stroke[]; aspect: number } | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const current = useRef<Pt[] | null>(null);
  const [count, setCount] = useState(0);

  const paint = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = getComputedStyle(c).color;
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      ctx.beginPath();
      s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (s.length === 1) ctx.lineTo(s[0]![0] + 0.1, s[0]![1] + 0.1);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const c = ref.current!;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = c.getBoundingClientRect();
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const pos = (e: React.PointerEvent): Pt => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const commit = () => {
    setCount(strokes.current.length);
    const m = normalizeStrokes(strokes.current);
    onChange(m ? { strokes: m.strokes, aspect: Math.min(12, Math.max(0.2, m.aspect)) } : null);
  };

  return (
    <div className="pad">
      <canvas
        ref={ref}
        className="pad-canvas"
        aria-label="Signature drawing area. Draw with a mouse, trackpad, finger or stylus."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = [pos(e)];
          paint();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current.push(pos(e));
          paint();
        }}
        onPointerUp={() => {
          if (current.current) strokes.current.push(current.current);
          current.current = null;
          paint();
          commit();
        }}
        onPointerCancel={() => {
          current.current = null;
          paint();
        }}
      />
      <div className="row-actions">
        <button
          type="button"
          className="btn small"
          disabled={count === 0}
          onClick={() => {
            strokes.current.pop();
            paint();
            commit();
          }}
        >
          Undo stroke
        </button>
        <button
          type="button"
          className="btn small"
          disabled={count === 0}
          onClick={() => {
            strokes.current = [];
            paint();
            commit();
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/** Tiny preview of stored strokes. */
function StrokePreview({ strokes, aspect }: { strokes: Stroke[]; aspect: number }) {
  const w = 240;
  const h = Math.max(30, Math.min(120, w / aspect));
  return (
    <svg
      className="stroke-preview"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Your signature strokes"
      width="100%"
      style={{ maxWidth: w }}
    >
      {strokes.map((s, i) => (
        <polyline
          key={i}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={s.map(([x, y]) => `${(x * w).toFixed(1)},${(y * h).toFixed(1)}`).join(' ')}
        />
      ))}
    </svg>
  );
}

export function MarkPanel() {
  const s = useStudioCtx();
  const mode = (getIn(s.draft, ['mark', 'mode']) as string) ?? 'typed';
  const strokes = getIn(s.draft, ['mark', 'strokes']) as Stroke[] | undefined;
  const aspect = (getIn(s.draft, ['mark', 'strokesAspect']) as number | undefined) ?? 3;
  const font = (getIn(s.draft, ['mark', 'font']) as string) ?? 'dancing-script';
  const textMode = (getIn(s.draft, ['mark', 'text']) as string) ?? 'full';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'good'; text: string } | null>(null);

  const setStrokes = (m: { strokes: Stroke[]; aspect: number } | null) =>
    s.update((d) => {
      const mark = { ...((d.mark as object) ?? {}), strokes: m?.strokes, strokesAspect: m?.aspect };
      return { ...d, mark };
    });

  const onScan = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const url = await loadImageFile(file, { maxSide: 900, transparent: true });
      const { data, width, height } = await dataUrlToRgba(url, 700);
      const m = vectorizeSignature(data, width, height);
      if (!m)
        throw new ImageError(
          'No ink was found. Use dark ink on a light or transparent background.',
        );
      setStrokes({ strokes: m.strokes, aspect: Math.min(12, Math.max(0.2, m.aspect)) });
      setMsg({
        tone: 'good',
        text: `Traced ${m.strokes.length} stroke${m.strokes.length === 1 ? '' : 's'}.`,
      });
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'Could not trace that image.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Signature mark" hint="Typed, drawn or scanned" id="mark">
      <ToggleField path="mark.enabled" label="Show the signature mark" />
      <Segmented
        path="mark.mode"
        label="Mode"
        options={[
          { value: 'typed', label: 'Typed' },
          { value: 'drawn', label: 'Drawn' },
          { value: 'uploaded', label: 'Scanned' },
        ]}
      />

      {mode === 'typed' && (
        <>
          <SelectField
            path="mark.text"
            label="Text"
            options={[
              { value: 'full', label: 'Full name' },
              { value: 'first', label: 'First name' },
              { value: 'initials', label: 'Initials' },
              { value: 'custom', label: 'Custom text' },
            ]}
          />
          {textMode === 'custom' && (
            <TextField path="mark.customText" label="Custom text" max={30} />
          )}
          <div className="field">
            <span className="lbl">Handwriting style</span>
            <div className="fonts" role="radiogroup" aria-label="Handwriting style">
              {INK_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={font === f.id}
                  className={`font-btn${font === f.id ? ' on' : ''}`}
                  style={{ fontFamily: `'mm-${f.id}', cursive` }}
                  onClick={() => s.set('mark.font', f.id)}
                  title={f.name}
                >
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
            <p className="field-hint">
              Fonts are baked into the image, so nothing loads in the email.
            </p>
          </div>
        </>
      )}

      {mode === 'drawn' && (
        <div className="field">
          <span className="lbl">Sign here</span>
          <SignaturePad onChange={setStrokes} />
          {strokes?.length ? (
            <StrokePreview strokes={strokes} aspect={aspect} />
          ) : (
            <p className="field-hint">
              Draw your signature above. It will be animated as a pen stroke.
            </p>
          )}
        </div>
      )}

      {mode === 'uploaded' && (
        <div className="field">
          <span className="lbl">Photo or scan of your signature</span>
          <div className="row-actions">
            <FileButton
              label={
                busy ? 'Tracing…' : strokes?.length ? 'Replace scan' : 'Upload signature image'
              }
              accept={ACCEPT}
              onFile={onScan}
              disabled={busy}
            />
            {strokes?.length ? (
              <button type="button" className="btn ghost small" onClick={() => setStrokes(null)}>
                Remove
              </button>
            ) : null}
          </div>
          <p className="field-hint">
            Sign in dark ink on white paper. The image is traced into pen strokes in your browser
            and is not uploaded.
          </p>
          {strokes?.length ? <StrokePreview strokes={strokes} aspect={aspect} /> : null}
        </div>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {mode !== 'typed' && !strokes?.length && (
        <Notice tone="warn">Until you add a signature, the typed name is shown.</Notice>
      )}

      <h4 className="sub">Look</h4>
      <PaintField
        path="mark.color"
        label="Ink colour"
        fallbackA="#b34700"
        fallbackB="#e2793d"
        hint="Auto uses your accent colour, adjusted to stay readable in dark mode."
      />
      <Segmented
        path="mark.strokeWidth"
        label="Stroke width"
        options={[
          { value: 'thin', label: 'Thin' },
          { value: 'medium', label: 'Medium' },
          { value: 'bold', label: 'Bold' },
        ]}
      />
      <ToggleField path="mark.glow" label="Neon glow" hint="A soft glow baked behind the ink." />

      <h4 className="sub">Animation</h4>
      <SelectField
        path="mark.animation"
        label="Animation"
        hint="Frame 1 always shows the finished signature."
        options={[
          { value: 'ink', label: 'Ink draw' },
          { value: 'fade', label: 'Fade in' },
          { value: 'none', label: 'None (static)' },
        ]}
      />
      <Segmented
        path="mark.speed"
        label="Draw speed"
        options={[
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ]}
      />
      <RangeField
        path="mark.holdMs"
        label="Hold time before it loops"
        min={0}
        max={5000}
        step={100}
        unit=" ms"
      />
      <Segmented
        path="mark.loop"
        label="Loop"
        options={[
          { value: 'forever', label: 'Forever' },
          { value: 'three', label: 'Play 3×, then stop' },
        ]}
      />

      <h4 className="sub">Size & position</h4>
      <Segmented
        path="mark.size"
        label="Size"
        options={[
          { value: 'S', label: 'Small' },
          { value: 'M', label: 'Medium' },
          { value: 'L', label: 'Large' },
        ]}
      />
      <SelectField
        path="mark.position"
        label="Position"
        options={[
          { value: 'below', label: 'Below the details' },
          { value: 'above', label: 'Above the name' },
          { value: 'beside', label: 'Beside the name' },
          { value: 'replace', label: 'Replace the name' },
        ]}
      />
    </Section>
  );
}
