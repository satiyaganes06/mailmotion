'use client';

import { useEffect, useMemo, useState } from 'react';
import { copyRichHtml } from '@/lib/exports';
import { checkHtml, decodePhonePayload, detectPlatform } from '@/lib/phone-link';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; html: string; expiresAt: number }
  | { kind: 'error'; message: string };

const MESSAGES = {
  invalid: 'This link is not valid. Create a new one from the builder.',
  expired: 'This link has expired (they last 24 hours). Create a new one from the builder.',
  unsafe: 'This signature could not be shown safely.',
} as const;

/** Runs in an iframe with scripts disabled: even a hostile payload cannot execute anything. */
function frameDoc(sig: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http://localhost:* blob:; style-src 'unsafe-inline'">
<style>body{margin:0;padding:16px;font:14px/1.5 -apple-system,system-ui,sans-serif;background:#fff;color:#222}</style></head><body>${sig}</body></html>`;
}

export function PhoneView() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const q = new URLSearchParams(window.location.search);
    (async () => {
      const d = hash.get('d');
      if (d) {
        const r = await decodePhonePayload(d);
        setState(
          r.ok
            ? { kind: 'ready', html: r.html, expiresAt: r.expiresAt }
            : { kind: 'error', message: MESSAGES[r.reason] },
        );
        return;
      }
      const api = q.get('api');
      const t = q.get('t');
      if (api && t && /^https?:\/\//.test(api) && /^[a-f0-9]{32}$/.test(t)) {
        try {
          const res = await fetch(`${api.replace(/\/+$/, '')}/share/${t}`, { cache: 'no-store' });
          if (res.status === 410) return setState({ kind: 'error', message: MESSAGES.expired });
          if (!res.ok) return setState({ kind: 'error', message: MESSAGES.invalid });
          const body = (await res.json()) as { html: string; expiresAt: number };
          const r = checkHtml(body.html, body.expiresAt);
          setState(
            r.ok
              ? { kind: 'ready', html: r.html, expiresAt: r.expiresAt }
              : { kind: 'error', message: MESSAGES[r.reason] },
          );
        } catch {
          setState({ kind: 'error', message: 'Could not reach the server this link points to.' });
        }
        return;
      }
      setState({ kind: 'error', message: MESSAGES.invalid });
    })();
  }, []);

  const doc = useMemo(() => (state.kind === 'ready' ? frameDoc(state.html) : ''), [state]);

  return (
    <main className="wrap phone">
      <p className="eyebrow">MailMotion</p>
      <h1>Your signature</h1>
      {state.kind === 'loading' && <p className="lede">Opening…</p>}
      {state.kind === 'error' && <p className="notice bad">{state.message}</p>}
      {state.kind === 'ready' && (
        <>
          <iframe title="Your signature" className="phone-frame" srcDoc={doc} sandbox="" />
          <button
            type="button"
            className="btn primary big"
            onClick={async () => {
              const ok = await copyRichHtml(state.html);
              setCopied(ok ? 'ok' : 'fail');
              setTimeout(() => setCopied('idle'), 2500);
            }}
          >
            {copied === 'ok'
              ? 'Copied. Now paste it into your mail app'
              : copied === 'fail'
                ? 'Copy failed. Press and hold the signature to copy'
                : 'Copy signature'}
          </button>
          <p className="fineprint">Valid until {new Date(state.expiresAt).toLocaleString()}.</p>
          <section className="phone-steps">
            {platform !== 'android' && (
              <div>
                <h2>Mail on iPhone / iPad</h2>
                <ol>
                  <li>Tap “Copy signature”.</li>
                  <li>
                    Open Settings → Apps → Mail → Signature (older iOS: Settings → Mail →
                    Signature).
                  </li>
                  <li>Clear the box, then paste.</li>
                  <li>
                    If the formatting looks lost, shake your phone and choose “Undo Change
                    Attributes”.
                  </li>
                </ol>
              </div>
            )}
            {platform !== 'ios' && (
              <div>
                <h2>Gmail app</h2>
                <ol>
                  <li>
                    Gmail’s mobile signature is plain text only. Turn it off instead: Menu →
                    Settings → your account → Mobile Signature → off.
                  </li>
                  <li>
                    Set your signature on Gmail on the web; the app uses it for Google accounts.
                  </li>
                </ol>
              </div>
            )}
            <div>
              <h2>Outlook app</h2>
              <ol>
                <li>Tap “Copy signature”.</li>
                <li>In Outlook: Settings → your account → Signature, and paste.</li>
              </ol>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
