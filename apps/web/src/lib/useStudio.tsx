'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { RenderedAsset } from '@mailmotion/renderer';
import type { SignatureAssets } from '@mailmotion/layouts';
import type { SignatureConfig } from '@mailmotion/schema';
import { analyzeSignature, serializeSignature, type Analysis } from '@mailmotion/serializer';
import { defaultDraft } from './defaults';
import {
  getIn,
  initHistory,
  parseDraft,
  reduce,
  type Action,
  type Draft,
  type Path,
} from './draft';
import { loadDraft, saveDraft, saveVersion } from './persist';
import { RenderClient, previewAssets, revokeAll } from './render-client';

export type RenderStatus = 'idle' | 'rendering' | 'error';

export interface StudioApi {
  draft: Draft;
  /** Validated config (the last valid one while the draft is being edited into an invalid state). */
  config: SignatureConfig;
  errors: Record<string, string>;
  valid: boolean;
  set: (path: Path | string, value: unknown) => void;
  update: (fn: (d: Draft) => Draft) => void;
  replace: (d: Draft) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hydrated: boolean;
  /** True when no saved draft existed (show the quick-start). */
  firstRun: boolean;
  dismissFirstRun: () => void;
  render: {
    status: RenderStatus;
    progress: number;
    error: string | null;
    assets: RenderedAsset[];
    preview: SignatureAssets | null;
    previewUrls: string[];
    stale: boolean;
  };
  analysis: Analysis;
  html: string;
  chars: number;
}

const Ctx = createContext<StudioApi | null>(null);
export const useStudioCtx = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudioCtx outside StudioProvider');
  return v;
};
export const StudioContextProvider = Ctx.Provider;

const toPath = (p: Path | string): Path =>
  typeof p === 'string' ? p.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s)) : p;

/** Read/write one field by dotted path (`details.title`, `socials.items.0.url`). */
export function useField<T = unknown>(path: string) {
  const s = useStudioCtx();
  const p = useMemo(() => toPath(path), [path]);
  const value = getIn(s.draft, p) as T | undefined;
  return { value, set: (v: unknown) => s.set(p, v), error: s.errors[path] };
}

export function useStudio(): StudioApi {
  const [hist, dispatch] = useReducer(reduce, undefined, () => initHistory(defaultDraft()));
  const [hydrated, setHydrated] = useState(false);
  const [firstRun, setFirstRun] = useState(false);

  // hydrate from the saved draft
  useEffect(() => {
    let live = true;
    loadDraft().then((d) => {
      if (!live) return;
      if (d) dispatch({ type: 'replace', draft: d });
      else setFirstRun(true);
      setHydrated(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const parsed = useMemo(() => parseDraft(hist.present), [hist.present]);
  const lastValid = useRef<SignatureConfig | null>(null);
  if (parsed.config) lastValid.current = parsed.config;
  const config = (parsed.config ?? lastValid.current ?? parseDraft(defaultDraft()).config)!;
  const valid = parsed.config !== null;

  // autosave (debounced) + occasional version snapshots
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => void saveDraft(hist.present), 600);
    return () => clearTimeout(t);
  }, [hist.present, hydrated]);
  useEffect(() => {
    if (!hydrated || !parsed.config) return;
    const cfg = parsed.config;
    const t = setTimeout(() => void saveVersion(cfg, 'Autosave'), 20_000);
    return () => clearTimeout(t);
  }, [parsed.config, hydrated]);

  // render pipeline
  const client = useRef<RenderClient | null>(null);
  const urlsRef = useRef<string[]>([]);
  const [renderState, setRenderState] = useState<StudioApi['render']>({
    status: 'idle',
    progress: 0,
    error: null,
    assets: [],
    preview: null,
    previewUrls: [],
    stale: false,
  });

  useEffect(() => {
    client.current = new RenderClient('/fonts');
    return () => {
      client.current?.dispose();
      revokeAll(urlsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !valid) return;
    setRenderState((r) => ({ ...r, stale: true }));
    let cancelled = false;
    const t = setTimeout(async () => {
      setRenderState((r) => ({ ...r, status: 'rendering', progress: 0, error: null }));
      try {
        const rendered = await client.current!.render(
          config,
          (done, total) =>
            !cancelled && setRenderState((r) => ({ ...r, progress: total ? done / total : 0 })),
        );
        if (cancelled || !rendered) return;
        const { assets, urls } = previewAssets(rendered);
        const old = urlsRef.current;
        urlsRef.current = urls;
        setRenderState({
          status: 'idle',
          progress: 1,
          error: null,
          assets: rendered,
          preview: assets,
          previewUrls: urls,
          stale: false,
        });
        // revoke after the new images are in the DOM
        setTimeout(() => revokeAll(old), 4000);
      } catch (e) {
        if (!cancelled)
          setRenderState((r) => ({
            ...r,
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          }));
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // config identity changes with every valid edit
  }, [config, hydrated, valid]);

  const analysis = useMemo(() => analyzeSignature(config), [config]);
  const { html, chars } = useMemo(() => {
    if (!renderState.preview) return { html: '', chars: analysis.chars };
    const r = serializeSignature(config, renderState.preview, { allowLocalPreview: true });
    return { html: r.html, chars: r.chars };
  }, [config, renderState.preview, analysis.chars]);

  const act = useCallback((a: Action) => dispatch(a), []);
  return {
    draft: hist.present,
    config,
    errors: parsed.errors,
    valid,
    set: (path, value) => act({ type: 'set', path: toPath(path), value }),
    update: (fn) => act({ type: 'update', fn }),
    replace: (draft) => act({ type: 'replace', draft }),
    undo: () => act({ type: 'undo' }),
    redo: () => act({ type: 'redo' }),
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    hydrated,
    firstRun,
    dismissFirstRun: () => setFirstRun(false),
    render: renderState,
    analysis,
    html,
    chars,
  };
}
