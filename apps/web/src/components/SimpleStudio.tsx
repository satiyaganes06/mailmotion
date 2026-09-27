'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SIMPLE_PRESET_LIST, applySimplePreset } from '@mailmotion/presets';
import { exportConfig, importConfig } from '@mailmotion/schema';
import { serializeSignature } from '@mailmotion/serializer';
import { firstFrameAssets, revokeAll } from '@/lib/render-client';
import { simpleDefaultDraft } from '@/lib/simple-defaults';
import type { Draft } from '@/lib/draft';
import { StudioContextProvider, useStudio } from '@/lib/useStudio';
import { downloadText } from '@/lib/exports';
import { ThemeToggle } from './ThemeToggle';
import { Meters } from './Meters';
import { Preview } from './Preview';
import { SimplePanel } from './panels/SimplePanel';
import { Notice } from './ui';
import { RegisterServiceWorker } from './RegisterServiceWorker';
import { RightPanels } from './studio-slots';

type View = 'edit' | 'preview' | 'install';

/** Simple Style's builder: the same render/upload pipeline as Custom Style, behind a much
 * smaller editor (ten designs, one colour, a handful of fields — see SimplePanel). */
export function SimpleStudio() {
  const studio = useStudio(simpleDefaultDraft);
  const [view, setView] = useState<View>('edit');
  const [firstFrameHtml, setFirstFrameHtml] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { config, render } = studio;

  // A draft saved from Custom Style (or an older session) may not be one of the ten Simple
  // designs — coerce it onto the closest one so the panel always has a design selected.
  useEffect(() => {
    if (!studio.hydrated) return;
    if (SIMPLE_PRESET_LIST.some((p) => p.id === config.presetId)) return;
    studio.replace(applySimplePreset(config, 'simple-aurora') as unknown as Draft);
    // only re-run if hydration state or the preset id itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.hydrated, config.presetId]);

  useEffect(() => {
    if (!render.assets.length) return;
    let live = true;
    let urls: string[] = [];
    firstFrameAssets(render.assets).then(({ assets, urls: u }) => {
      urls = u;
      if (!live) return revokeAll(u);
      setFirstFrameHtml(serializeSignature(config, assets, { allowLocalPreview: true }).html);
    });
    return () => {
      live = false;
      setTimeout(() => revokeAll(urls), 4000);
    };
  }, [render.assets, config]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        studio.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  const onImport = async (file: File) => {
    const text = await file.text();
    const r = importConfig(text);
    if (r.ok) {
      studio.replace(r.config as unknown as Draft);
      setMessage({ tone: 'good', text: 'Signature imported.' });
    } else {
      setMessage({ tone: 'bad', text: `Could not import: ${r.errors.slice(0, 3).join('; ')}` });
    }
  };

  return (
    <StudioContextProvider value={studio}>
      <RegisterServiceWorker />
      <div className="studio">
        <header className="studio-bar">
          <Link href="/" className="brand" aria-label="MailMotion home">
            <span className="brand-mark" aria-hidden="true" />
            <span className="hide-sm">MailMotion</span>
          </Link>
          <div className="bar-actions">
            <Link href="/start/?change=1" className="btn ghost small">
              ← Change style
            </Link>
            <button
              type="button"
              className="btn ghost small"
              onClick={studio.undo}
              disabled={!studio.canUndo}
              aria-label="Undo"
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={studio.redo}
              disabled={!studio.canRedo}
              aria-label="Redo"
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              ↷
            </button>
            <span className="saved hide-sm" aria-live="polite">
              {studio.hydrated ? 'Saved in this browser' : 'Loading…'}
            </span>
          </div>
          <div className="bar-actions right">
            <button
              type="button"
              className="btn small hide-sm"
              onClick={() =>
                downloadText(
                  `${(config.name ?? config.details.fullName).replace(/\W+/g, '-').toLowerCase()}.mailmotion.json`,
                  exportConfig(config),
                  'application/json',
                )
              }
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn small hide-sm"
              onClick={() => fileRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <button
              type="button"
              className="btn small hide-sm"
              onClick={() => {
                if (confirm('Start over with the sample signature? You can undo this.'))
                  studio.replace(simpleDefaultDraft());
              }}
            >
              Reset
            </button>
            <ThemeToggle />
          </div>
        </header>

        {message && (
          <div className="studio-msg" onClick={() => setMessage(null)}>
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        )}

        <nav className="tabs" aria-label="Builder sections">
          {(['edit', 'preview', 'install'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'on' : ''}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === 'edit' ? 'Edit' : v === 'preview' ? 'Preview' : 'Install'}
            </button>
          ))}
        </nav>

        <div className={`studio-body view-${view}`}>
          <aside className="editor" aria-label="Editor">
            <SimplePanel />
          </aside>
          <div className="workspace">
            <Preview
              html={studio.html}
              firstFrameHtml={firstFrameHtml}
              busy={render.status === 'rendering' || render.stale}
            />
            <Meters />
            <RightPanels />
          </div>
        </div>
      </div>
    </StudioContextProvider>
  );
}
