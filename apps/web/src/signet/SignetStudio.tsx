'use client';

import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import './signet.css';
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
import { hostImages, hostingConfigured, missing, type Hosted, type HostProgress } from './host';

/**
 * Simple Style: the Signet reference page (packages/signet/test/fixtures/signet-reference.html),
 * recreated element for element. The one functional change: instead of asking where you will
 * host the GIFs yourself, "Upload images" renders them and uploads them to this site's storage,
 * exactly like Custom Style — and copied signatures point at the uploaded images.
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
  if (!hostingConfigured)
    status =
      'This site has no image storage configured (NEXT_PUBLIC_UPLOAD_ENDPOINT and NEXT_PUBLIC_UPLOAD_TOKEN), so the GIFs cannot be hosted yet.';
  else if (progress) status = progressText(progress);
  else if (error) status = error;
  else if (!mounted) status = ' ';
  else if (todo.length === 0)
    status = (
      <span className="sg-status-ok">
        All {DESIGNS.length} animated images are uploaded. Copied signatures point to them.
      </span>
    );
  else if (todo.length === DESIGNS.length)
    status =
      'Renders the ten animated GIFs in your browser and uploads them to this site’s image storage. Copied signatures then point to them.';
  else
    status = `${todo.length} of ${DESIGNS.length} images changed with your details — upload again before copying those.`;

  return (
    <div className="sg">
      <div className="sg-top">
        <div className="sg-back">
          <a href="/start/?change=1">← Change style</a>
        </div>
        <h1>Signet</h1>
        <p>
          Ten starter designs for animated email signatures that work in Gmail and Outlook. Each one
          is table-based HTML with inline styles; only the outlined part is animated, and in the
          real signature it ships as a hosted GIF.
        </p>
      </div>

      <div
        className={`sg-wrap${staticPreview ? ' sg-static' : ''}${outline ? ' sg-outline' : ''}`}
        id="wrap"
      >
        <aside>
          <div className="sg-airmail" />
          <div className="sg-inner">
            <h2>Your details</h2>
            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
              {FIELDS.map((f) => (
                <div key={f.id} style={{ display: 'contents' }}>
                  <label htmlFor={`sg-${f.id}`}>{f.label}</label>
                  <input
                    type={f.type}
                    id={`sg-${f.id}`}
                    value={values[f.id]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  />
                </div>
              ))}
              <label htmlFor="sg-accent">Accent colour</label>
              <div className="sg-row">
                <input
                  type="color"
                  id="sg-accent"
                  value={/^#[0-9a-f]{6}$/i.test(values.accent) ? values.accent.toLowerCase() : a}
                  onChange={(e) => setValues((v) => ({ ...v, accent: e.target.value }))}
                />
                <span className="sg-hint" style={{ margin: 0 }}>
                  Used for the GIF and the links
                </span>
              </div>
              {/* a heading for the section, not a label: the button keeps its own name */}
              <label id="sg-images">Animated images</label>
              <button
                type="button"
                id="sg-upload"
                className="sg-upload"
                disabled={busy || !hostingConfigured}
                onClick={upload}
              >
                {busy ? 'Uploading…' : 'Upload images'}
              </button>
              <p className="sg-hint" role="status" aria-live="polite">
                {status}
              </p>
              <label className="sg-check">
                <input
                  type="checkbox"
                  checked={staticPreview}
                  onChange={(e) => setStaticPreview(e.target.checked)}
                />{' '}
                Preview as classic Outlook for Windows (first frame only)
              </label>
              <label className="sg-check">
                <input
                  type="checkbox"
                  checked={outline}
                  onChange={(e) => setOutline(e.target.checked)}
                />{' '}
                Outline the animated parts
              </label>
            </form>
          </div>
        </aside>

        <main>
          {DESIGNS.map((t) => {
            const url = urlFor(t);
            const html = exportHtml(t, d, a, url ?? PLACEHOLDER_URL);
            return (
              <section className="sg-spec" key={t.id} data-id={t.id}>
                <header>
                  <div>
                    <h2>{t.name}</h2>
                    <p className="sg-use">{t.use}</p>
                  </div>
                  <span className="sg-size">
                    GIF {t.w} &times; {t.h}
                  </span>
                </header>
                <div className="sg-pane">
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
                <div className="sg-actions">
                  <button type="button" onClick={() => copy(t, 'rich')}>
                    Copy signature
                  </button>
                  <button type="button" className="sg-ghost" onClick={() => copy(t, 'src')}>
                    Copy HTML source
                  </button>
                  <span className={`sg-count${html.length > LIMIT ? ' sg-over' : ''}`}>
                    {mounted ? `${html.length.toLocaleString()} / 10,000 characters` : ' '}
                  </span>
                </div>
              </section>
            );
          })}
        </main>
      </div>

      <footer>
        Signatures stay under Gmail&apos;s 10,000-character limit. Text, phone numbers and links
        stay live HTML so they remain clickable and readable when images are blocked.
      </footer>
      <div className={`sg-toast${toast.show ? ' sg-show' : ''}`} role="status" aria-live="polite">
        {toast.text}
      </div>
    </div>
  );
}
