'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STYLE_KEY = 'mm:style-pref:v1';
type StylePref = 'simple' | 'custom';

function rememberedStyle(): StylePref | null {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    return v === 'simple' || v === 'custom' ? v : null;
  } catch {
    return null;
  }
}

function remember(pref: StylePref) {
  try {
    localStorage.setItem(STYLE_KEY, pref);
  } catch {
    /* ignore */
  }
}

/**
 * Pick-a-style page in front of the builder ("Open builder", "Build my signature" and the
 * "Change style" link inside each builder all land here). It always asks; the style you used
 * last is only marked, never auto-opened, so the other one is always one click away.
 */
export default function StartPage() {
  const [last, setLast] = useState<StylePref | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => setLast(rememberedStyle()), []);

  const go = (pref: StylePref) => {
    remember(pref);
    setOpening(true);
    window.location.href = pref === 'simple' ? '/studio/simple/' : '/studio/';
  };

  const card = (pref: StylePref, title: string, text: string) => (
    <button
      type="button"
      className={`start-card${last === pref ? ' last' : ''}`}
      onClick={() => go(pref)}
      disabled={opening}
    >
      <span className="start-card-head">
        <strong>{title}</strong>
        {last === pref && <span className="chip">Last used</span>}
      </span>
      <span className="field-hint">{text}</span>
    </button>
  );

  return (
    <main className="start-gate">
      <div className="start-wrap">
        <p className="eyebrow">Before you start</p>
        <h1>Pick your style</h1>
        <p className="lede">
          Both use the same real renderer and image hosting. This only decides how much you get to
          configure, and you can switch any time from inside the builder.
        </p>
        <div className="start-cards">
          {card(
            'simple',
            'Simple Style',
            'Ten ready-made designs, one accent colour, a handful of fields. Fastest way to a good-looking signature.',
          )}
          {card(
            'custom',
            'Custom Style',
            'Six designs, every field, full control: palettes, socials, banners, CTAs, badges, typography and more.',
          )}
        </div>
        <p className="field-hint">
          {opening ? 'Opening the builder…' : <Link href="/">← Back home</Link>}
        </p>
      </div>
    </main>
  );
}
