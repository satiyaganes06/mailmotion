'use client';

import { useEffect, useMemo, useState } from 'react';
import { LIMITS } from '@mailmotion/schema';
import {
  fileBaseName,
  serializeSignature,
  toHtmDocument,
  toMailSignature,
} from '@mailmotion/serializer';
import { buildTestEml } from '@/lib/eml';
import { copyRichHtml, copyText, downloadText } from '@/lib/exports';
import { GUIDES, type Guide } from '@/lib/guides';
import { assetsFromHosted } from '@/lib/hosting';
import {
  deleteVersion,
  listVersions,
  saveVersion,
  versionToDraft,
  type SavedVersion,
} from '@/lib/persist';
import { useHosted } from '@/lib/useHosted';
import { useStudioCtx } from '@/lib/useStudio';
import { HostStep, loadServerSettings, type ServerSettings } from './install/HostStep';
import { PhoneShare } from './install/PhoneShare';
import { Notice } from './ui';

type CopyState = 'idle' | 'ok' | 'fail';

function GuideCard({ g, actions }: { g: Guide; actions: React.ReactNode }) {
  return (
    <details className="guide">
      <summary>
        <span>{g.title}</span>
      </summary>
      <ol>
        {g.steps.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      {g.note && <p className="field-hint">{g.note}</p>}
      {actions}
    </details>
  );
}

function Versions() {
  const s = useStudioCtx();
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  useEffect(() => {
    void listVersions().then(setVersions);
  }, []);
  return (
    <details className="panel mini-panel">
      <summary>
        <span>Saved versions</span>
        <small>{versions.length}</small>
      </summary>
      <div className="panel-body">
        <button
          type="button"
          className="btn small"
          disabled={!s.valid}
          onClick={async () => setVersions(await saveVersion(s.config, 'Saved by you'))}
        >
          Save this version now
        </button>
        {versions.length === 0 && (
          <p className="field-hint">Versions are saved automatically as you work (last 20).</p>
        )}
        <ul className="versions">
          {versions.map((v) => (
            <li key={v.id}>
              <span>
                {v.label} · {new Date(v.at).toLocaleString()}
              </span>
              <span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    const d = versionToDraft(v);
                    if (d) s.replace(d);
                  }}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="btn ghost small danger"
                  onClick={async () => setVersions(await deleteVersion(v.id))}
                  aria-label="Delete this version"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function InstallPanel() {
  const s = useStudioCtx();
  const { hosted, setHosted } = useHosted();
  const [server, setServerState] = useState<ServerSettings>({
    endpoint: '',
    token: '',
    remember: false,
  });
  const [copy, setCopy] = useState<CopyState>('idle');
  const [copySrc, setCopySrc] = useState<CopyState>('idle');

  useEffect(() => setServerState(loadServerSettings()), []);

  const hostedAssets = useMemo(
    () => assetsFromHosted(s.render.assets, hosted),
    [s.render.assets, hosted],
  );
  const exported = useMemo(
    () => (hostedAssets && s.valid ? serializeSignature(s.config, hostedAssets) : null),
    [hostedAssets, s.config, s.valid],
  );
  const html = exported?.html ?? null;
  const chars = exported?.chars ?? 0;
  const over = chars > LIMITS.htmlChars;
  const ready = Boolean(html) && !s.render.stale && s.render.status !== 'rendering';
  const base = fileBaseName(s.config.name ?? s.config.details.fullName);

  const flash = (set: (v: CopyState) => void, ok: boolean) => {
    set(ok ? 'ok' : 'fail');
    setTimeout(() => set('idle'), 2000);
  };

  const actions = {
    copy: (
      <button
        type="button"
        className="btn primary small"
        disabled={!ready || over}
        onClick={async () => flash(setCopy, await copyRichHtml(html!))}
      >
        {copy === 'ok'
          ? 'Copied'
          : copy === 'fail'
            ? 'Copy failed: select the preview and copy'
            : 'Copy formatted signature'}
      </button>
    ),
    htm: (
      <button
        type="button"
        className="btn small"
        disabled={!ready}
        onClick={() =>
          downloadText(`${base}.htm`, toHtmDocument(html!, s.config.details.fullName), 'text/html')
        }
      >
        Download .htm
      </button>
    ),
    mailsignature: (
      <button
        type="button"
        className="btn small"
        disabled={!ready}
        onClick={() =>
          downloadText(
            `${base}.mailsignature`,
            toMailSignature(html!, crypto.randomUUID()),
            'text/plain',
          )
        }
      >
        Download .mailsignature
      </button>
    ),
    phone: null,
  } as const;

  return (
    <section className="install" aria-label="Install your signature">
      <h2 className="install-title">Get it into your email</h2>
      <HostStep
        hosted={hosted}
        setHosted={setHosted}
        server={server}
        setServer={(next) => {
          setServerState(next);
          try {
            if (next.remember) localStorage.setItem('mm:server:v1', JSON.stringify(next));
            else
              localStorage.setItem(
                'mm:server:v1',
                JSON.stringify({ endpoint: next.endpoint, remember: false }),
              );
          } catch {
            /* ignore */
          }
        }}
      />

      <div className={`step${ready ? '' : ' disabled'}`}>
        <div className="step-head">
          <h3>2 · Install</h3>
          {html && (
            <span className={`chip ${over ? 'bad' : 'ok'}`}>
              {chars.toLocaleString('en-US')} chars
            </span>
          )}
        </div>
        {!html && (
          <p className="field-hint">
            Host your images first. Then you can copy the signature, download files and create a
            phone link.
          </p>
        )}
        {over && (
          <Notice tone="bad">
            This signature is over Gmail's {LIMITS.htmlChars.toLocaleString('en-US')}-character
            limit, so the formatted copy is blocked. Use the "Make it fit" suggestions above. You
            can still copy the HTML source for other clients.
          </Notice>
        )}

        <div className="row-actions">
          {actions.copy}
          <button
            type="button"
            className="btn small"
            disabled={!ready}
            onClick={async () => flash(setCopySrc, await copyText(html!))}
          >
            {copySrc === 'ok' ? 'Copied' : 'Copy HTML source'}
          </button>
          {actions.htm}
          {actions.mailsignature}
          <button
            type="button"
            className="btn small"
            disabled={!ready}
            onClick={() => downloadText(`${base}-test.eml`, buildTestEml(html!), 'message/rfc822')}
            title="Opens as an email draft in Outlook and Apple Mail so you can send it to yourself"
          >
            Download test email (.eml)
          </button>
        </div>

        <h4 className="sub">Send to my phone</h4>
        {html ? (
          <PhoneShare html={html} server={server} />
        ) : (
          <p className="field-hint">Available once images are hosted.</p>
        )}

        <h4 className="sub">Step-by-step guides</h4>
        {(['Gmail', 'Outlook', 'Apple Mail'] as const).map((fam) => (
          <div key={fam} className="guide-group">
            <strong>{fam}</strong>
            {GUIDES.filter((g) => g.family === fam).map((g) => (
              <GuideCard
                key={g.id}
                g={g}
                actions={<div className="row-actions">{actions[g.method]}</div>}
              />
            ))}
          </div>
        ))}
        <p className="field-hint">
          Install steps change as mail apps update. If something differs, see{' '}
          <a href="/docs/install/">the install guides</a> and{' '}
          <a href="/compat/">the compatibility page</a>.
        </p>
      </div>
      <Versions />
    </section>
  );
}
