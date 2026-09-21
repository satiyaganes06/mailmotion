'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { encodePhonePayload, phoneServerUrl, phoneUrl, QR_MAX_CHARS } from '@/lib/phone-link';
import { copyText } from '@/lib/exports';
import { Notice } from '../ui';
import type { ServerSettings } from './HostStep';

/** QR code + private link that opens the signature on a phone, ready to copy into its mail app. */
export function PhoneShare({ html, server }: { html: string; server: ServerSettings }) {
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const make = async (useServer: boolean) => {
    setBusy(true);
    setError(null);
    setQr(null);
    try {
      let url: string;
      if (useServer) {
        const res = await fetch(`${server.endpoint.replace(/\/+$/, '')}/share`, {
          method: 'POST',
          headers: { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ html }),
        });
        if (!res.ok)
          throw new Error(
            res.status === 401
              ? 'Upload token was rejected.'
              : `Your server refused the share (${res.status}).`,
          );
        const { token } = (await res.json()) as { token: string };
        url = phoneServerUrl(window.location.origin, server.endpoint.replace(/\/+$/, ''), token);
      } else {
        url = phoneUrl(window.location.origin, await encodePhonePayload(html));
      }
      setLink(url);
      if (url.length <= QR_MAX_CHARS)
        setQr(await QRCode.toDataURL(url, { errorCorrectionLevel: 'L', margin: 1, width: 220 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setLink(null);
    setQr(null);
  }, [html]);

  const canServer = Boolean(server.endpoint && server.token);
  return (
    <div className="phone-share">
      <div className="row-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => make(false)}>
          {link ? 'Refresh link' : 'Create private link'}
        </button>
        {canServer && (
          <button type="button" className="btn" disabled={busy} onClick={() => make(true)}>
            Short link via my server
          </button>
        )}
      </div>
      {link && (
        <div className="phone-out">
          {qr ? (
            <img
              src={qr}
              width={220}
              height={220}
              alt="QR code that opens your signature on your phone"
            />
          ) : (
            <Notice tone="info">
              This signature is too large for a QR code. Copy the link and open it on your phone.
            </Notice>
          )}
          <div>
            <p className="field-hint">
              Scan with your phone camera, or copy the link. It works for 24 hours and is not
              indexed by search engines.
              {link.includes('#d=')
                ? ' The signature travels inside the link and is never sent to a server.'
                : ''}
            </p>
            <button
              type="button"
              className="btn small"
              onClick={async () => {
                setCopied(await copyText(link));
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
