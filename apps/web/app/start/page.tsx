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
 * Pick-a-style gate in front of the builder. `/start/` (from the landing page or the top nav)
 * skips straight to whichever style you used last; `/start/?change=1` (the "Change style" link
 * inside each builder) always shows the chooser, so switching is never a dead end.
 */
export default function StartPage() {
  const [checked, setChecked] = useState(false);
  const [redirecting, setRedirecting] = useState<StylePref | null>(null);

  useEffect(() => {
    const change = new URLSearchParams(window.location.search).get('change') === '1';
    const remembered = change ? null : rememberedStyle();
    if (remembered) {
      setRedirecting(remembered);
      window.location.replace(remembered === 'simple' ? '/studio/simple/' : '/studio/');
      return;
    }
    setChecked(true);
  }, []);

  const go = (pref: StylePref) => {
    remember(pref);
    setRedirecting(pref);
    window.location.href = pref === 'simple' ? '/studio/simple/' : '/studio/';
  };

  if (!checked || redirecting) {
    return (
      <main className="start-gate">
        <p className="field-hint">Opening the builder…</p>
      </main>
    );
  }

  return (
    <main className="start-gate">
      <div className="start-wrap">
        <p className="eyebrow">Before you start</p>
        <h1>Pick your style</h1>
        <p className="lede">
          Both use the same real renderer and one-click image hosting — this only decides how much
          you get to configure. You can switch any time from inside the builder.
        </p>
        <div className="start-cards">
          <button type="button" className="start-card" onClick={() => go('simple')}>
            <strong>Simple Style</strong>
            <span className="field-hint">
              Ten ready-made designs, one accent colour, a handful of fields. Fastest way to a
              good-looking signature.
            </span>
          </button>
          <button type="button" className="start-card" onClick={() => go('custom')}>
            <strong>Custom Style</strong>
            <span className="field-hint">
              Six designs, every field, full control: palettes, socials, banners, CTAs, badges,
              typography and more.
            </span>
          </button>
        </div>
        <p className="field-hint">
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
