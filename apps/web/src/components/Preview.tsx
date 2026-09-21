'use client';

import { useMemo, useState } from 'react';

export type ClientId = 'gmail' | 'outlook' | 'outlook-classic' | 'apple';
type Device = 'desktop' | 'phone';
type Scheme = 'light' | 'dark';

export const CLIENTS: { id: ClientId; label: string; note: string }[] = [
  { id: 'gmail', label: 'Gmail', note: 'Web, iOS and Android. Images are proxied and cached.' },
  {
    id: 'outlook',
    label: 'Outlook (new/web/Mac/mobile)',
    note: 'Animated GIFs play. Mobile apps apply their own dark mode.',
  },
  {
    id: 'outlook-classic',
    label: 'Outlook classic (2016/2019)',
    note: 'Word engine: shows frame 1 of every GIF only.',
  },
  {
    id: 'apple',
    label: 'Apple Mail',
    note: 'macOS, iOS and iPadOS. GIFs play. Dark mode adjusts colours only partly.',
  },
];

const CHROME: Record<ClientId, { font: string; head: string; bg: string; accent: string }> = {
  gmail: {
    font: "'Google Sans', Roboto, Arial, sans-serif",
    head: '#f2f6fc',
    bg: '#ffffff',
    accent: '#d93025',
  },
  outlook: {
    font: "'Segoe UI', system-ui, sans-serif",
    head: '#f3f2f1',
    bg: '#ffffff',
    accent: '#0f6cbd',
  },
  'outlook-classic': {
    font: "Calibri, 'Segoe UI', sans-serif",
    head: '#e9eef5',
    bg: '#ffffff',
    accent: '#2b579a',
  },
  apple: {
    font: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
    head: '#f5f5f7',
    bg: '#ffffff',
    accent: '#0a84ff',
  },
};

/** Build the iframe document. The signature HTML is already lint-checked; the frame has scripts disabled and a CSP. */
export function previewDocument(
  sig: string,
  client: ClientId,
  scheme: Scheme,
  device: Device,
): string {
  const c = CHROME[client];
  const fullInvert =
    scheme === 'dark' &&
    (client === 'gmail' || client === 'outlook' || client === 'outlook-classic');
  const bg = scheme === 'dark' ? '#202124' : c.bg;
  const fg = scheme === 'dark' ? '#e8eaed' : '#202124';
  const headBg = scheme === 'dark' ? '#2b2b2e' : c.head;
  // Gmail/Outlook dark mode invert colours; approximate by inverting the signature and re-inverting images.
  const invert = fullInvert ? 'filter:invert(1) hue-rotate(180deg);' : '';
  const imgFix = fullInvert ? 'img{filter:invert(1) hue-rotate(180deg)}' : '';
  const sigBg = fullInvert ? '#ffffff' : 'transparent';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob: https: data:; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html,body{margin:0;background:${bg};color:${fg};font:${device === 'phone' ? '15px' : '14px'}/1.5 ${c.font}}
.bar{background:${headBg};padding:10px 16px;border-bottom:1px solid ${scheme === 'dark' ? '#3c4043' : '#e3e3e3'};font-size:12.5px}
.bar b{font-weight:600}.bar span{opacity:.7}
.acc{display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.accent};margin-right:6px}
.msg{padding:16px}.msg p{margin:0 0 12px}
.sig{margin-top:18px;padding-top:2px;${invert}background:${sigBg}}
${imgFix}
</style></head><body>
<div class="bar"><span class="acc"></span><b>You</b> <span>to Sam Rivera</span><br><span>Re: Quick question about Thursday</span></div>
<div class="msg"><p>Hi Sam,</p><p>Thanks for the update. Thursday works for me. I'll send the slides over beforehand.</p><p>Best,</p>
<div class="sig">${sig}</div></div>
</body></html>`;
}

export function Preview({
  html,
  firstFrameHtml,
  busy,
}: {
  html: string;
  firstFrameHtml: string | null;
  busy: boolean;
}) {
  const [client, setClient] = useState<ClientId>('gmail');
  const [device, setDevice] = useState<Device>('desktop');
  const [scheme, setScheme] = useState<Scheme>('light');
  const active = client === 'outlook-classic' ? (firstFrameHtml ?? html) : html;
  const doc = useMemo(
    () => previewDocument(active, client, scheme, device),
    [active, client, scheme, device],
  );
  const note = CLIENTS.find((c) => c.id === client)!.note;

  return (
    <section className="preview" aria-label="Signature preview">
      <div className="preview-bar">
        <label className="sr-only" htmlFor="pv-client">
          Email client
        </label>
        <select
          id="pv-client"
          value={client}
          onChange={(e) => setClient(e.target.value as ClientId)}
        >
          {CLIENTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="seg-mini" role="radiogroup" aria-label="Device">
          {(['desktop', 'phone'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={device === d}
              className={device === d ? 'on' : ''}
              onClick={() => setDevice(d)}
            >
              {d === 'desktop' ? 'Desktop' : 'Phone'}
            </button>
          ))}
        </div>
        <div className="seg-mini" role="radiogroup" aria-label="Colour scheme">
          {(['light', 'dark'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scheme === s}
              className={scheme === s ? 'on' : ''}
              onClick={() => setScheme(s)}
            >
              {s === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
        {busy && <span className="chip live">rendering…</span>}
      </div>
      <div className={`stage-frame ${device}`}>
        {html ? (
          <iframe
            title={`Signature preview in ${client}`}
            srcDoc={doc}
            sandbox="allow-same-origin"
            className="preview-frame"
            loading="eager"
          />
        ) : (
          <div className="preview-empty">Rendering your signature…</div>
        )}
      </div>
      <p className="preview-note">
        {note} Dark-mode previews are an approximation; real clients differ.{' '}
        {client === 'outlook-classic' && 'Frame 1 of each GIF is shown.'}
      </p>
    </section>
  );
}
