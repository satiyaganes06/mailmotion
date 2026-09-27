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
import {
  ensureHosted,
  hostImages,
  hostingConfigured,
  missing,
  warm,
  type Hosted,
  type HostProgress,
} from './host';

/**
 * Simple Style: the ten Signet designs (packages/signet) in a builder dressed in MailMotion's own
 * design system. The signatures, their live CSS previews and the copied HTML are the Signet
 * reference exactly; only the builder around them uses the site's look. Copying a design renders
 * and uploads just that design's GIF to this site's storage (like Custom Style); nothing is
 * uploaded while you browse or edit.
 */

type FieldId = keyof SignetData | 'accent';

// the reference form's fields and default values, in order
const FIELDS: { id: keyof SignetData; label: string; type: 'text' | 'email'; value: string }[] = [
  { id: 'name', label: 'Full name', type: 'text', value: 'Shatthiya Ganes' },
  { id: 'title', label: 'Job title', type: 'text', value: 'Mobile Security Engineer' },
  { id: 'company', label: 'Company', type: 'text', value: 'Vigilant Asia' },
  { id: 'phone', label: 'Phone', type: 'text', value: '+60 1163348685' },
  { id: 'email', label: 'Email', type: 'email', value: 'satiyaganes.sg@gmail.com' },
  { id: 'website', label: 'Website', type: 'text', value: 'www.satiyaganes.site' },
  {
    id: 'tagline',
    label: 'Tagline',
    type: 'text',
    value: 'Full-stack security & mobile engineering',
  },
  { id: 'status', label: 'Status line', type: 'text', value: 'Open to opportunities' },
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

const plainOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Copy HTML that may still be on its way (the image is being uploaded). The clipboard write must
 * start inside the click, so it is started now with promised contents; browsers that can't take
 * promised contents get the reference's copy paths once the HTML is ready — which may fail
 * without a fresh click, in which case the caller asks for one.
 */
async function copyLater(kind: 'rich' | 'src', html: Promise<string>): Promise<boolean> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = (type: string, f: (h: string) => string) =>
      html.then((h) => new Blob([f(h)], { type }));
    const data: Record<string, Promise<Blob>> = kind === 'rich'
      ? { 'text/html': blob('text/html', (h) => h), 'text/plain': blob('text/plain', plainOf) }
      : { 'text/plain': blob('text/plain', (h) => h) };
    try {
      await navigator.clipboard.write([new ClipboardItem(data)]);
      return true;
    } catch {
      /* promised contents unsupported, or the upload failed: see below */
    }
  }
  const h = await html; // rethrows an upload failure
  return kind === 'rich' ? copyRich(h) : copyText(h);
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
  const [preparing, setPreparing] = useState<Partial<Record<SignetDesign['id'], boolean>>>({});
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

  // Copying is what uploads: render + upload just this design (unless it's already hosted for
  // these details), then put the signature on the clipboard.
  const copy = (design: SignetDesign, kind: 'rich' | 'src') => {
    if (!hostingConfigured) {
      showToast(
        'This site has no image storage configured, so the animated image can’t be hosted.',
      );
      return;
    }
    const key = slotKey(design.id, d, a);
    const known = hosted[key];
    if (!known) setPreparing((p) => ({ ...p, [design.id]: true }));
    const url = ensureHosted(design, d, a, hosted);
    const html = url.then((u) => {
      setHosted((h) => (h[key] === u ? h : { ...h, [key]: u }));
      return exportHtml(design, d, a, u);
    });
    void copyLater(kind, html)
      .then((ok) =>
        showToast(
          ok
            ? kind === 'rich'
              ? 'Signature copied. Paste it into the Gmail or Outlook signature box.'
              : 'HTML source copied.'
            : known
              ? 'Copy was blocked by the browser. Use Copy HTML source instead.'
              : 'Image ready — click Copy again to put the signature on the clipboard.',
        ),
      )
      .catch((e: unknown) =>
        showToast(e instanceof Error ? e.message : 'Could not upload the image.'),
      )
      .finally(() => setPreparing((p) => ({ ...p, [design.id]: false })));
  };

  const hostedCount = DESIGNS.length - todo.length;
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
  else if (hostedCount === 0)
    status =
      'Nothing is uploaded while you browse or edit. Copying a design renders and uploads just that design’s animated image, in a second or two.';
  else if (hostedCount === DESIGNS.length) {
    tone = 'good';
    status = `All ${DESIGNS.length} animated images are uploaded. Copied signatures point to them.`;
  } else
    status = `${hostedCount} of ${DESIGNS.length} designs are hosted for your current details. Copying another uploads just that one.`;

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
              <p
                className={tone === 'plain' ? 'field-hint' : `notice ${tone}`}
                role="status"
                aria-live="polite"
              >
                {status}
              </p>
              {todo.length > 0 && (
                <button
                  type="button"
                  className="btn small"
                  disabled={busy || !hostingConfigured}
                  onClick={upload}
                >
                  {busy ? 'Uploading…' : `Upload all ${todo.length} now`}
                </button>
              )}
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
              Fill in your details once, then copy the design you like. Its animated image is
              uploaded for you when you copy it, and nothing else is. Each signature is table-based
              HTML with inline styles that works in Gmail and Outlook; only the outlined part is
              animated, as a hosted GIF.
            </p>
          </div>

          {DESIGNS.map((t) => {
            const url = urlFor(t);
            const html = exportHtml(t, d, a, url ?? PLACEHOLDER_URL);
            return (
              <section
                className="g-card sg-spec"
                key={t.id}
                data-id={t.id}
                onPointerEnter={() => warm(t, d, a, hosted)}
                onFocus={() => warm(t, d, a, hosted)}
              >
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
