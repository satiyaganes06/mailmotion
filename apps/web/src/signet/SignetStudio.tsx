'use client';

import './signet.css';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DESIGNS,
  exportHtml,
  normalize,
  previewHtml,
  slotKey,
  type SignetData,
  type SignetDesign,
} from '@mailmotion/signet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { hostImages, hostingConfigured, missing, type Hosted, type HostProgress } from './host';

/**
 * Simple Style: the ten Signet designs (packages/signet) in a builder dressed in MailMotion's own
 * design system. The signatures, their live CSS previews and the copied HTML are the Signet
 * reference exactly; only the builder around them uses the site's look. "Upload images" renders
 * the ten GIFs and uploads them to this site's storage, like Custom Style.
 */

type FieldId = keyof SignetData | 'accent';

// the reference form's fields and default values, in order
const FIELDS: { id: keyof SignetData; label: string; type: 'text' | 'email'; value: string }[] = [
  { id: 'name', label: 'Full name', type: 'text', value: 'Aina Rahman' },
  { id: 'title', label: 'Job title', type: 'text', value: 'Product Designer' },
  { id: 'company', label: 'Company', type: 'text', value: 'Lumen Labs' },
  { id: 'phone', label: 'Phone', type: 'text', value: '+60 12 345 6789' },
  { id: 'email', label: 'Email', type: 'email', value: 'aina@lumenlabs.io' },
  { id: 'website', label: 'Website', type: 'text', value: 'lumenlabs.io' },
  { id: 'tagline', label: 'Tagline', type: 'text', value: 'Designing calmer fintech apps' },
  { id: 'status', label: 'Status line', type: 'text', value: 'Available for calls this week' },
];

// A colour input reports its value in lowercase, so this is what the reference page actually uses.
const DEFAULT_VALUES: Record<FieldId, string> = {
  ...(Object.fromEntries(FIELDS.map((f) => [f.id, f.value])) as Record<keyof SignetData, string>),
  accent: '#2a5db0',
};

const STORE_KEY = 'mm:simple-style:v1';
/** A realistic stand-in for an uploaded image's address, so the character count is honest. */
const PLACEHOLDER_URL = `https://img.example.com/${'0'.repeat(64)}.gif`;
const LIMIT = 10000;

interface Saved {
  values: Record<FieldId, string>;
  hosted: Hosted;
}

function load(): Saved | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Saved> | null;
    if (!raw || typeof raw !== 'object') return null;
    const values = { ...DEFAULT_VALUES };
    for (const k of Object.keys(values) as FieldId[])
      if (typeof raw.values?.[k] === 'string') values[k] = raw.values[k]!;
    const hosted: Hosted = {};
    for (const [k, v] of Object.entries(raw.hosted ?? {}))
      if (typeof v === 'string' && /^https?:\/\//.test(v)) hosted[k] = v;
    return { values, hosted };
  } catch {
    return null;
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage full: the page still works, it just won't remember */
  }
}

/* ------------------------------------------------------------------ clipboard (as on the reference) */

async function copyRich(html: string): Promise<boolean> {
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
    return true;
  } catch {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    el.innerHTML = html;
    el.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(el);
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* ignore */
    }
    sel.removeAllRanges();
    el.remove();
    return ok;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* ignore */
    }
    ta.remove();
    return ok;
  }
}

/* ------------------------------------------------------------------ page */

function progressText(p: HostProgress): string {
  if (p.phase === 'verify')
    return `Checking the uploaded image${p.total === 1 ? '' : 's'} load back…`;
  const verb = p.phase === 'render' ? 'Rendering' : 'Uploading';
  return `${verb} ${p.name} (${p.index + 1} of ${p.total})…`;
}

export function SignetStudio() {
  const [values, setValues] = useState<Record<FieldId, string>>(DEFAULT_VALUES);
  const [hosted, setHosted] = useState<Hosted>({});
  const [staticPreview, setStaticPreview] = useState(false);
  const [outline, setOutline] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<HostProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const saved = load();
    if (saved) {
      setValues(saved.values);
      setHosted(saved.hosted);
    }
    setMounted(true);
  }, []);
  useEffect(() => {
    if (mounted) save({ values, hosted });
  }, [values, hosted, mounted]);

  const d = useMemo(() => normalize(values), [values]);
  const a = d.accent;
  const todo = useMemo(() => missing(d, a, hosted), [d, a, hosted]);
  const busy = progress !== null;

  const showToast = (text: string) => {
    setToast({ text, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 2600);
  };

  const upload = async () => {
    setError(null);
    try {
      const next = await hostImages(d, a, hosted, setProgress);
      setHosted(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setProgress(null);
    }
  };

  const urlFor = (design: SignetDesign) => hosted[slotKey(design.id, d, a)];

  const copy = async (design: SignetDesign, kind: 'rich' | 'src') => {
    const url = urlFor(design);
    if (!url) {
      showToast('Upload the images first (“Upload images” on the left), then copy.');
      return;
    }
    const html = exportHtml(design, d, a, url);
    const ok = kind === 'rich' ? await copyRich(html) : await copyText(html);
    showToast(
      ok
        ? kind === 'rich'
          ? 'Signature copied. Paste it into the Gmail or Outlook signature box.'
          : 'HTML source copied.'
        : 'Copy was blocked by the browser. Use Copy HTML source instead.',
    );
  };

  let status: React.ReactNode;
  let tone: 'plain' | 'good' | 'bad' = 'plain';
  if (!hostingConfigured) {
    tone = 'bad';
    status =
      'This site has no image storage configured (NEXT_PUBLIC_UPLOAD_ENDPOINT and NEXT_PUBLIC_UPLOAD_TOKEN), so the GIFs cannot be hosted yet.';
  } else if (progress) status = progressText(progress);
  else if (error) {
    tone = 'bad';
    status = error;
  } else if (!mounted) status = '\u00a0';
  else if (todo.length === 0) {
    tone = 'good';
    status = `All ${DESIGNS.length} animated images are uploaded. Copied signatures point to them.`;
  } else if (todo.length === DESIGNS.length)
    status =
      'Renders the ten animated GIFs in your browser and uploads them to this site’s image storage. Copied signatures then point to them.';
  else
    status = `${todo.length} of ${DESIGNS.length} images changed with your details — upload again before copying those.`;

  return (
    <div className="sg studio">
      <header className="studio-bar">
        <Link href="/" className="brand" aria-label="MailMotion home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="hide-sm">MailMotion</span>
        </Link>
        <div className="bar-actions">
          <a href="/start/?change=1" className="btn ghost small">
            ← Change style
          </a>
          <span className="saved hide-sm" aria-live="polite">
            {mounted ? 'Saved in this browser' : 'Loading…'}
          </span>
        </div>
        <div className="bar-actions right">
          <span className="chip hide-sm">Simple Style</span>
          <ThemeToggle />
        </div>
      </header>

      <div className={`sg-wrap${staticPreview ? ' sg-static' : ''}${outline ? ' sg-outline' : ''}`}>
        <aside className="sg-editor" aria-label="Editor">
          <form className="panel" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <h2 className="sg-panel-head">
              Your details <small>Shown in all ten designs</small>
            </h2>
            <div className="panel-body">
              {FIELDS.map((f) => (
                <div className="field" key={f.id}>
                  <label htmlFor={`sg-${f.id}`}>{f.label}</label>
                  <input
                    type={f.type}
                    id={`sg-${f.id}`}
                    value={values[f.id]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="field">
                <label htmlFor="sg-accent">Accent colour</label>
                <div className="sg-color">
                  <input
                    type="color"
                    id="sg-accent"
                    value={/^#[0-9a-f]{6}$/i.test(values.accent) ? values.accent.toLowerCase() : a}
                    onChange={(e) => setValues((v) => ({ ...v, accent: e.target.value }))}
                  />
                  <code>{a.toLowerCase()}</code>
                  <span className="field-hint">Used for the GIF and the links</span>
                </div>
              </div>
            </div>
          </form>

          <section className="panel" aria-labelledby="sg-images">
            <h2 className="sg-panel-head" id="sg-images">
              Animated images{' '}
              <small>
                {mounted ? `${DESIGNS.length - todo.length} of ${DESIGNS.length} uploaded` : ''}
              </small>
            </h2>
            <div className="panel-body">
              <button
                type="button"
                className="btn primary"
                disabled={busy || !hostingConfigured}
                onClick={upload}
              >
                {busy ? 'Uploading…' : 'Upload images'}
              </button>
              <p
                className={tone === 'plain' ? 'field-hint' : `notice ${tone}`}
                role="status"
                aria-live="polite"
              >
                {status}
              </p>
            </div>
          </section>

          <section className="panel" aria-labelledby="sg-preview">
            <h2 className="sg-panel-head" id="sg-preview">
              Preview
            </h2>
            <div className="panel-body">
              <label className="sg-toggle">
                <input
                  type="checkbox"
                  checked={staticPreview}
                  onChange={(e) => setStaticPreview(e.target.checked)}
                />
                Preview as classic Outlook for Windows (first frame only)
              </label>
              <label className="sg-toggle">
                <input
                  type="checkbox"
                  checked={outline}
                  onChange={(e) => setOutline(e.target.checked)}
                />
                Outline the animated parts
              </label>
            </div>
          </section>
        </aside>

        <main className="sg-list">
          <div className="sg-intro">
            <p className="eyebrow">Simple Style</p>
            <h1>Ten ready-made designs</h1>
            <p className="lede">
              Fill in your details once, upload the animated images in one click, then copy the
              design you like. Each signature is table-based HTML with inline styles that works in
              Gmail and Outlook; only the outlined part is animated, as a hosted GIF.
            </p>
          </div>

          {DESIGNS.map((t) => {
            const url = urlFor(t);
            const html = exportHtml(t, d, a, url ?? PLACEHOLDER_URL);
            return (
              <section className="g-card sg-spec" key={t.id} data-id={t.id}>
                <header className="g-head">
                  <div>
                    <h2>{t.name}</h2>
                    <p className="sg-use">{t.use}</p>
                  </div>
                  <span className={`chip${mounted && url ? ' ok' : ''} sg-size`}>
                    GIF {t.w} &times; {t.h}
                  </span>
                </header>
                <div className="g-stage sg-pane">
                  <div className="sg-mail">
                    <p className="sg-body">
                      Hi Daniel, thanks for the call today. The revised proposal is attached.
                      <br />
                      <br />
                      Best regards,
                    </p>
                    <p className="sg-dash">--</p>
                    {/* Trusted: built by the Signet templates, which escape every user value. */}
                    <div
                      className="sg-sig"
                      dangerouslySetInnerHTML={{ __html: previewHtml(t, d, a) }}
                    />
                  </div>
                </div>
                <div className="sg-actions">
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => copy(t, 'rich')}
                  >
                    Copy signature
                  </button>
                  <button type="button" className="btn small" onClick={() => copy(t, 'src')}>
                    Copy HTML source
                  </button>
                  <span className={`sg-count${html.length > LIMIT ? ' sg-over' : ''}`}>
                    {mounted ? `${html.length.toLocaleString()} / 10,000 characters` : '\u00a0'}
                  </span>
                </div>
              </section>
            );
          })}

          <p className="field-hint sg-foot">
            Signatures stay under Gmail&apos;s 10,000-character limit. Text, phone numbers and links
            stay live HTML so they remain clickable and readable when images are blocked.
          </p>
        </main>
      </div>

      <div className={`sg-toast${toast.show ? ' sg-show' : ''}`} role="status" aria-live="polite">
        {toast.text}
      </div>
    </div>
  );
}
