'use client';

import { useEffect, useState } from 'react';
import { buildBundle } from '@mailmotion/renderer';
import { verifyPublicUrls } from '@mailmotion/storage';
import { githubConfigured, env } from '@/lib/env';
import {
  GitHubAuthError,
  RepoMissingError,
  clearToken,
  getToken,
  publishToGitHub,
  startSignIn,
  type PublishStep,
} from '@/lib/github-flow';
import { downloadBlob } from '@/lib/exports';
import { hostedFromBaseUrl, missingFiles, publishToServer, type Hosted } from '@/lib/hosting';
import { useStudioCtx } from '@/lib/useStudio';
import { Notice } from '../ui';

type Tab = 'github' | 'server' | 'zip';

const STEP_LABEL: Record<PublishStep, string> = {
  checking: 'Checking your GitHub account…',
  committing: 'Uploading images in a single commit…',
  pages: 'Turning on GitHub Pages…',
  waiting: 'Waiting for GitHub Pages to publish (about a minute)…',
  done: 'Published.',
};

export const SERVER_KEY = 'mm:server:v1';

export interface ServerSettings {
  endpoint: string;
  token: string;
  remember: boolean;
}

export function loadServerSettings(): ServerSettings {
  try {
    const raw = JSON.parse(
      localStorage.getItem(SERVER_KEY) ?? 'null',
    ) as Partial<ServerSettings> | null;
    if (raw)
      return {
        endpoint: String(raw.endpoint ?? ''),
        token: raw.remember ? String(raw.token ?? '') : '',
        remember: Boolean(raw.remember),
      };
  } catch {
    /* ignore */
  }
  return { endpoint: '', token: '', remember: false };
}

export function HostStep({
  hosted,
  setHosted,
  server,
  setServer,
}: {
  hosted: Hosted | null;
  setHosted: (h: Hosted | null) => void;
  server: ServerSettings;
  setServer: (s: ServerSettings) => void;
}) {
  const s = useStudioCtx();
  const rendered = s.render.assets;
  const [tab, setTab] = useState<Tab>(githubConfigured ? 'github' : 'server');
  const [step, setStep] = useState<PublishStep | null>(null);
  const [detail, setDetail] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [repoMissing, setRepoMissing] = useState<RepoMissingError | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setConnected(Boolean(getToken())), [tab, busy]);

  const missing = missingFiles(rendered, hosted);
  const ready =
    rendered.length > 0 && !s.render.stale && s.render.status !== 'rendering' && s.valid;
  const isHosted = ready && missing.length === 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setRepoMissing(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof RepoMissingError) setRepoMissing(e);
      else if (e instanceof GitHubAuthError) {
        clearToken();
        setError(e.message);
      } else setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  const publishGitHub = () =>
    run(async () => {
      const r = await publishToGitHub(rendered, (st, d) => {
        setStep(st);
        setDetail(d ?? '');
      });
      setHosted({
        via: 'github',
        fileUrls: r.fileUrls,
        label: `${r.owner}/${r.repo}`,
        at: Date.now(),
      });
      setNote(
        `Published ${r.uploaded} new and reused ${r.skipped} existing image${r.skipped === 1 ? '' : 's'} at ${r.baseUrl}.`,
      );
    });

  const publishServer = () =>
    run(async () => {
      const h = await publishToServer(
        rendered,
        { endpoint: server.endpoint, token: server.token },
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
      try {
        if (server.remember) localStorage.setItem(SERVER_KEY, JSON.stringify(server));
        else
          localStorage.setItem(
            SERVER_KEY,
            JSON.stringify({ endpoint: server.endpoint, remember: false }),
          );
      } catch {
        /* ignore */
      }
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
      <p className="field-hint">
        Gmail and Outlook only show images from a public https address. Choose how to host yours.
      </p>

      <div className="tabs-mini" role="tablist" aria-label="Hosting method">
        {(
          [
            ['github', 'GitHub Pages (free)'],
            ['server', 'Your storage'],
            ['zip', 'Download ZIP'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'github' && (
        <div className="tabpanel" role="tabpanel">
          {!githubConfigured ? (
            <Notice tone="info">
              One-click GitHub publishing needs a GitHub App configured for this site (
              <code>NEXT_PUBLIC_GITHUB_APP_CLIENT_ID</code>). See{' '}
              <a href="/docs/github-pages/">the GitHub Pages guide</a>, or use "Your storage" or
              "Download ZIP".
            </Notice>
          ) : (
            <>
              <Notice tone="warn">
                <span>
                  <strong>Your images will be public.</strong> On free GitHub accounts, Pages needs
                  a public repository ({env.repoName}). Your avatar, signature mark and name become
                  visible there (they are in every email you send anyway). Deleting the repo breaks
                  images in emails already sent.
                </span>
              </Notice>
              <div className="toggle">
                <input
                  id="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <label htmlFor="consent">I understand my signature images will be public</label>
              </div>
              {!connected ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={!consent || busy}
                  onClick={() => run(startSignIn)}
                >
                  Publish free with GitHub
                </button>
              ) : (
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!ready || busy || !consent}
                    onClick={publishGitHub}
                  >
                    {busy ? 'Publishing…' : isHosted ? 'Publish again' : 'Publish images'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      clearToken();
                      setConnected(false);
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
              {step && (
                <p className="progress" role="status">
                  {STEP_LABEL[step]} {detail}
                </p>
              )}
              {repoMissing && (
                <Notice tone="info">
                  <span>
                    <strong>One quick step:</strong> GitHub does not let apps create repositories in
                    your account. Create <code>{repoMissing.repo}</code> (public), install the
                    MailMotion app on it, then press Publish again.
                    <br />
                    <a href={repoMissing.createUrl} target="_blank" rel="noopener noreferrer">
                      1. Create the repository ↗
                    </a>
                    {env.githubAppSlug && (
                      <>
                        {' · '}
                        <a
                          href={`https://github.com/apps/${env.githubAppSlug}/installations/new`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          2. Install the app on it ↗
                        </a>
                      </>
                    )}
                  </span>
                </Notice>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'server' && (
        <div className="tabpanel" role="tabpanel">
          <div className="field">
            <label htmlFor="srv-endpoint">Storage server address</label>
            <input
              id="srv-endpoint"
              type="url"
              value={server.endpoint}
              placeholder="https://img.example.com"
              onChange={(e) => setServer({ ...server, endpoint: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="srv-token">Upload token</label>
            <input
              id="srv-token"
              type="password"
              autoComplete="off"
              value={server.token}
              onChange={(e) => setServer({ ...server, token: e.target.value })}
            />
            <p className="field-hint">
              The MM_UPLOAD_TOKEN from your server's .env. It stays in this tab unless you tick
              "remember".
            </p>
          </div>
          <div className="toggle">
            <input
              id="srv-remember"
              type="checkbox"
              checked={server.remember}
              onChange={(e) => setServer({ ...server, remember: e.target.checked })}
            />
            <label htmlFor="srv-remember">Remember the token in this browser</label>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={!ready || busy || !server.endpoint || !server.token}
            onClick={publishServer}
          >
            {busy ? `Uploading… ${detail}` : 'Upload images'}
          </button>
          <p className="field-hint">
            Run your own with <code>docker compose up</code>. See{' '}
            <a href="/docs/self-hosting/">Self-hosting</a>.
          </p>
        </div>
      )}

      {tab === 'zip' && (
        <div className="tabpanel" role="tabpanel">
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
              <button
                type="button"
                className="btn"
                disabled={!ready || !baseUrl}
                onClick={applyBase}
              >
                Use this address
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice tone="good">{note}</Notice>}
      {!ready && <p className="field-hint">Waiting for the preview to finish rendering…</p>}
    </div>
  );
}
