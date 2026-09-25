'use client';

import { useState } from 'react';
import { buildBundle } from '@mailmotion/renderer';
import { verifyPublicUrls } from '@mailmotion/storage';
import { autoUploadConfigured, env } from '@/lib/env';
import { downloadBlob } from '@/lib/exports';
import { hostedFromBaseUrl, missingFiles, publishToServer, type Hosted } from '@/lib/hosting';
import { useStudioCtx } from '@/lib/useStudio';
import { Notice } from '../ui';

/** Kept so PhoneShare can share the shape of `env.uploadEndpoint`/`env.uploadToken`. */
export interface ServerSettings {
  endpoint: string;
  token: string;
  remember: boolean;
}

export function HostStep({
  hosted,
  setHosted,
}: {
  hosted: Hosted | null;
  setHosted: (h: Hosted | null) => void;
}) {
  const s = useStudioCtx();
  const rendered = s.render.assets;
  const [detail, setDetail] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const missing = missingFiles(rendered, hosted);
  const ready =
    rendered.length > 0 && !s.render.stale && s.render.status !== 'rendering' && s.valid;
  const isHosted = ready && missing.length === 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const publishServer = () =>
    run(async () => {
      const h = await publishToServer(
        rendered,
        { endpoint: env.uploadEndpoint, token: env.uploadToken },
        (d, t) => setDetail(`${d} / ${t}`),
      );
      // health check: does every URL really serve the right Content-Type?
      const checks = await verifyPublicUrls(Object.values(h.fileUrls));
      const bad = checks.filter((c) => !c.ok);
      if (bad.length)
        throw new Error(
          `Uploaded, but ${bad.length} image URL${bad.length === 1 ? '' : 's'} did not load correctly (${bad[0]!.error}). Check MM_PUBLIC_BASE_URL and your proxy.`,
        );
      setHosted(h);
      setNote(`Uploaded ${Object.keys(h.fileUrls).length} images and verified every URL.`);
    });

  const downloadZip = () => {
    const cfg = s.config;
    const b = buildBundle(cfg, rendered, {
      baseUrl: hosted?.via === 'manual' ? hosted.label : undefined,
    });
    downloadBlob(
      `${(cfg.name ?? cfg.details.fullName).replace(/\W+/g, '-').toLowerCase() || 'signature'}-mailmotion.zip`,
      new Blob([b.zip as BlobPart], { type: 'application/zip' }),
    );
  };

  const applyBase = () => {
    const r = hostedFromBaseUrl(rendered, baseUrl);
    if (!r.ok) return setError(r.error);
    setError(null);
    setHosted(r.hosted);
    setNote(
      'Using your base URL. Make sure every file from the ZIP is uploaded there with the same names.',
    );
  };

  return (
    <div className="step">
      <div className="step-head">
        <h3>1 · Host your images</h3>
        <span className={`chip ${isHosted ? 'ok' : 'live'}`}>
          {isHosted
            ? `hosted · ${hosted!.via}${hosted!.label ? ` · ${hosted!.label}` : ''}`
            : hosted && missing.length
              ? `${missing.length} new image${missing.length === 1 ? '' : 's'} to publish`
              : 'not hosted yet'}
        </span>
      </div>
      <p className="field-hint">Gmail and Outlook only show images from a public https address.</p>

      <div className="tabpanel" role="tabpanel">
        {autoUploadConfigured ? (
          <>
            <button
              type="button"
              className="btn primary"
              disabled={!ready || busy}
              onClick={publishServer}
            >
              {busy ? `Uploading… ${detail}` : isHosted ? 'Upload again' : 'Upload images'}
            </button>
            <p className="field-hint">
              Uploads straight to this deployment's storage bucket ({env.uploadEndpoint}). Nothing
              to enter.
            </p>
          </>
        ) : (
          <Notice tone="info">
            No storage bucket is configured for this deployment. Set{' '}
            <code>NEXT_PUBLIC_UPLOAD_ENDPOINT</code> and <code>NEXT_PUBLIC_UPLOAD_TOKEN</code> in
            your <code>.env</code> (pointing at your storage server's address and its
            <code> MM_UPLOAD_TOKEN</code>), then rebuild. See{' '}
            <a href="/docs/self-hosting/">Self-hosting</a>. Until then, use "Download ZIP" below.
          </Notice>
        )}
      </div>

      <details className="tabpanel">
        <summary>Download ZIP instead</summary>
        <p className="field-hint">
          Get all images, the HTML and instructions in one file. Upload the images anywhere public
          (your website, Netlify Drop, Cloudflare Pages), then enter the address below.
        </p>
        <button type="button" className="btn" disabled={!ready} onClick={downloadZip}>
          Download ZIP
        </button>
        <div className="field">
          <label htmlFor="zip-base">Where you uploaded the images (base URL)</label>
          <div className="inline">
            <input
              id="zip-base"
              type="url"
              value={baseUrl}
              placeholder="https://example.com/signature"
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <button type="button" className="btn" disabled={!ready || !baseUrl} onClick={applyBase}>
              Use this address
            </button>
          </div>
        </div>
      </details>

      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice tone="good">{note}</Notice>}
      {!ready && <p className="field-hint">Waiting for the preview to finish rendering…</p>}
    </div>
  );
}
