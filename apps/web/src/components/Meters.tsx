'use client';

import { LIMITS } from '@mailmotion/schema';
import { useStudioCtx } from '@/lib/useStudio';
import { Notice } from './ui';

const kb = (n: number) => `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;

function Bar({
  value,
  max,
  warnAt,
  label,
  right,
}: {
  value: number;
  max: number;
  warnAt?: number;
  label: string;
  right: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const tone = value > max ? 'bad' : warnAt && value >= warnAt ? 'warn' : 'good';
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="mono">{right}</span>
      </div>
      <div
        className={`meter-bar ${tone}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Meters() {
  const s = useStudioCtx();
  const { analysis, render, config } = s;
  const gifs = render.assets.filter((a) => a.format === 'gif');
  const seen = new Set<string>();

  const applyColor = (field: 'accent' | 'name' | 'title' | 'body', suggested: string) => {
    if (field === 'accent') s.set('theme.accent', suggested);
    else s.set(`theme.textColors.${field}`, suggested);
  };

  return (
    <section className="meters" aria-label="Budgets">
      <Bar
        label="HTML characters (Gmail limit)"
        value={analysis.chars}
        max={LIMITS.htmlChars}
        warnAt={LIMITS.htmlWarnChars}
        right={`${analysis.chars.toLocaleString('en-US')} / ${LIMITS.htmlChars.toLocaleString('en-US')}`}
      />
      {gifs.map((g) => {
        if (seen.has(g.fileName)) return null;
        seen.add(g.fileName);
        return (
          <Bar
            key={g.fileName}
            label={`${g.kind === 'mark' ? 'Signature mark' : g.kind === 'avatar' ? 'Avatar' : g.kind === 'banner' ? 'Banner' : 'Logo'} GIF (${g.frames} frames)`}
            value={g.bytes.length}
            max={LIMITS.gifBytes}
            warnAt={LIMITS.gifBytes * 0.8}
            right={`${kb(g.bytes.length)} / 300 KB`}
          />
        );
      })}
      {gifs.some((g) => g.degraded.length > 0) && (
        <Notice tone="info">
          Some GIFs were optimised to stay under 300 KB:{' '}
          {[...new Set(gifs.flatMap((g) => g.degraded))].join(', ')}.
        </Notice>
      )}

      {analysis.warnings.map((w) => (
        <Notice key={w} tone={analysis.charStatus === 'over' ? 'bad' : 'warn'}>
          {w}
        </Notice>
      ))}
      {analysis.charStatus !== 'ok' && analysis.fixes.length > 0 && (
        <div className="fixes">
          <strong>Make it fit:</strong>
          {analysis.fixes.slice(0, 4).map((f) => (
            <button
              key={f.id}
              type="button"
              className="btn small"
              onClick={() => s.replace(f.apply(config) as never)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {analysis.contrast.map((c) => (
        <Notice key={c.field + c.problem} tone="warn">
          {c.problem === 'light'
            ? `The ${c.field} colour ${c.chosen} is hard to read on the signature background (contrast ${c.lightRatio.toFixed(1)}:1, needs 4.5:1).`
            : `The ${c.field} colour ${c.chosen} may be hard to see in dark mode (${c.darkRatio.toFixed(1)}:1).`}{' '}
          {(c.field === 'accent' ||
            c.field === 'name' ||
            c.field === 'title' ||
            c.field === 'body') && (
            <button
              type="button"
              className="btn small"
              onClick={() => applyColor(c.field as 'accent', c.suggested)}
            >
              Use {c.suggested}
            </button>
          )}
        </Notice>
      ))}
      {render.status === 'error' && <Notice tone="bad">Rendering failed: {render.error}</Notice>}
      {!s.valid && (
        <Notice tone="warn">
          Some fields need attention. The preview shows your last valid version.
        </Notice>
      )}
    </section>
  );
}
