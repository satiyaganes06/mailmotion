import { del, get, set } from 'idb-keyval';
import { importConfig, exportConfig, type SignatureConfig } from '@mailmotion/schema';
import type { Draft } from './draft';

/**
 * Drafts and version history live in IndexedDB (photos make configs too big for localStorage).
 * Every call is wrapped: storage can be blocked (private windows) and the app must still work.
 */
const DRAFT_KEY = 'mm:draft:v1';
const VERSIONS_KEY = 'mm:versions:v1';
export const MAX_VERSIONS = 20;

export interface SavedVersion {
  id: string;
  at: number;
  label: string;
  /** Portable JSON (same format as the export). */
  json: string;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const loadDraft = () => safe(() => get<Draft>(DRAFT_KEY).then((d) => d ?? null), null);
export const saveDraft = (d: Draft) => safe(() => set(DRAFT_KEY, d), undefined);
export const clearDraft = () => safe(() => del(DRAFT_KEY), undefined);

export const listVersions = () =>
  safe(() => get<SavedVersion[]>(VERSIONS_KEY).then((v) => v ?? []), [] as SavedVersion[]);

export async function saveVersion(
  config: SignatureConfig,
  label: string,
  now = Date.now(),
): Promise<SavedVersion[]> {
  const versions = await listVersions();
  const json = exportConfig(config, new Date(now));
  // skip if identical to the newest snapshot
  if (
    versions[0] &&
    versions[0].json.split('\n').slice(3).join('\n') === json.split('\n').slice(3).join('\n')
  )
    return versions;
  const next = [
    { id: `${now}-${Math.random().toString(36).slice(2, 7)}`, at: now, label, json },
    ...versions,
  ].slice(0, MAX_VERSIONS);
  await safe(() => set(VERSIONS_KEY, next), undefined);
  return next;
}

export async function deleteVersion(id: string): Promise<SavedVersion[]> {
  const next = (await listVersions()).filter((v) => v.id !== id);
  await safe(() => set(VERSIONS_KEY, next), undefined);
  return next;
}

/** Restore a saved version into a draft. */
export function versionToDraft(v: SavedVersion): Draft | null {
  const r = importConfig(v.json);
  return r.ok ? (r.config as unknown as Draft) : null;
}
