'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { exportConfig, importConfig } from '@mailmotion/schema';
import { serializeSignature } from '@mailmotion/serializer';
import { firstFrameAssets, revokeAll } from '@/lib/render-client';
import { defaultDraft } from '@/lib/defaults';
import type { Draft } from '@/lib/draft';
import { StudioContextProvider, useStudio } from '@/lib/useStudio';
import { downloadText } from '@/lib/exports';
import { ThemeToggle } from './ThemeToggle';
import { Meters } from './Meters';
import { Preview } from './Preview';
import { DesignPanel } from './panels/DesignPanel';
import { DetailsPanel } from './panels/DetailsPanel';
import { Notice } from './ui';
import { Onboarding } from './Onboarding';
import { RegisterServiceWorker } from './RegisterServiceWorker';
import { EXTRA_PANELS, RightPanels } from './studio-slots';

type View = 'edit' | 'preview' | 'install';

export function Studio() {
  const studio = useStudio();
  const [view, setView] = useState<View>('edit');
  const [firstFrameHtml, setFirstFrameHtml] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { config, render } = studio;

  // "classic Outlook shows frame 1 only": same HTML, animated GIFs swapped for their first frame
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

  // returning from GitHub sign-in: jump to the install panel
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('publish') === '1') setView('install');
  }, []);

  // keyboard: undo/redo when not typing in a text field
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
        if (!(
          t instanceof HTMLInputElement &&
          (t.type === 'range' || t.type === 'checkbox' || t.type === 'radio')
        ))
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
      {studio.firstRun && <Onboarding />}
      <div className="studio">
        <header className="studio-bar">
          <Link href="/" className="brand" aria-label="MailMotion home">
            <span className="brand-mark" aria-hidden="true" />
            <span className="hide-sm">MailMotion</span>
          </Link>
          <div className="bar-actions">
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
                  studio.replace(defaultDraft());
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
            <DesignPanel />
            <DetailsPanel />
            {EXTRA_PANELS.map((P, i) => (
              <P key={i} />
            ))}
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
