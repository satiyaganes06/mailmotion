'use client';

import { useEffect, useRef, useState } from 'react';
import { PRESET_LIST, applyPreset } from '@mailmotion/presets';
import type { PresetId } from '@mailmotion/schema';
import gallery from '@/generated/gallery.json';
import type { Draft } from '@/lib/draft';
import { ImageError, loadImageFile, ACCEPT } from '@/lib/imageio';
import { useStudioCtx } from '@/lib/useStudio';
import { FileButton } from './ui';

type Entry = { html: string };
const previews = gallery as Record<string, Entry>;

/**
 * First-visit quick start: pick a design → enter your details (and a photo) → done, in about a
 * minute. Everything else stays available in the editor.
 */
export function Onboarding() {
  const s = useStudioCtx();
  const [step, setStep] = useState<1 | 2>(1);
  const [preset, setPreset] = useState<PresetId>('aurora');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && s.dismissFirstRun();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    const base = applyPreset(s.config, preset) as unknown as Draft;
    s.update(() => {
      const details = {
        ...((base.details as object) ?? {}),
        fullName: name.trim() || 'Your Name',
        title: title.trim() || undefined,
        company: company.trim() || undefined,
        email: email.trim() || undefined,
      };
      const avatar = photo
        ? { ...((base.avatar as object) ?? {}), source: 'photo', image: photo }
        : base.avatar;
      return { ...base, details, avatar };
    });
    s.dismissFirstRun();
  };

  const onPhoto = async (file: File) => {
    setError(null);
    try {
      setPhoto(await loadImageFile(file, { maxSide: 512, transparent: false }));
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'That image could not be used.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        ref={dialog}
      >
        <p className="eyebrow">Quick start · step {step} of 2</p>
        {step === 1 ? (
          <>
            <h2 id="ob-title">Pick a design</h2>
            <p className="field-hint">
              You can change everything afterwards, or remix parts of different designs.
            </p>
            <div className="ob-designs" role="radiogroup" aria-label="Design">
              {PRESET_LIST.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={preset === p.id}
                  className={`ob-card${preset === p.id ? ' on' : ''}`}
                  onClick={() => setPreset(p.id)}
                >
                  <span className="ob-preview" aria-hidden="true">
                    {/* Trusted: generated at build time by our own serializer from fixed sample data. */}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: (previews[p.id]?.html ?? '').replaceAll(
                          '<img ',
                          '<img loading="lazy" ',
                        ),
                      }}
                    />
                  </span>
                  <strong>{p.name}</strong>
                  <small>{p.bestFor}</small>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={s.dismissFirstRun}>
                Skip
              </button>
              <button type="button" className="btn primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="ob-title">Your details</h2>
            <div className="ob-form">
              <div className="field">
                <label htmlFor="ob-name">Full name</label>
                <input
                  id="ob-name"
                  type="text"
                  value={name}
                  maxLength={60}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="row cols-2">
                <div className="field">
                  <label htmlFor="ob-title-f">Job title</label>
                  <input
                    id="ob-title-f"
                    type="text"
                    value={title}
                    maxLength={80}
                    autoComplete="organization-title"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ob-company">Company</label>
                  <input
                    id="ob-company"
                    type="text"
                    value={company}
                    maxLength={80}
                    autoComplete="organization"
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="ob-email">Email (optional)</label>
                <input
                  id="ob-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="upload-row">
                {photo ? (
                  <img className="thumb" src={photo} alt="" width={44} height={44} />
                ) : (
                  <span className="thumb empty" aria-hidden="true" />
                )}
                <FileButton
                  label={photo ? 'Replace photo' : 'Add a photo (optional)'}
                  accept={ACCEPT}
                  onFile={onPhoto}
                />
              </div>
              <p className="field-hint">
                Your photo is processed in your browser and never uploaded until you publish the
                images yourself.
              </p>
              {error && <p className="field-error">{error}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn primary" onClick={finish}>
                Create my signature
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
