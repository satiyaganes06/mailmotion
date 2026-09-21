import { safeParseConfig, type SignatureConfig } from '@mailmotion/schema';

/**
 * The editor works on a permissive "draft" (what the user has typed so far) and derives a validated
 * `SignatureConfig` from it. Half-typed values never crash the preview: the last valid config keeps
 * rendering while the offending field shows its error.
 */
export type Draft = Record<string, unknown>;
export type Path = (string | number)[];

/** Remove empty strings/undefined recursively so optional schema fields stay optional. */
export function pruneEmpty(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(pruneEmpty);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === '' || val === undefined || val === null) continue;
      out[k] = pruneEmpty(val);
    }
    return out;
  }
  return v;
}

export function getIn(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

/** Immutable set; creates missing objects/arrays along the way. */
export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path as [string | number, ...Path];
  const isIdx = typeof head === 'number';
  const base = (
    Array.isArray(obj)
      ? [...obj]
      : obj && typeof obj === 'object'
        ? { ...(obj as object) }
        : isIdx
          ? []
          : {}
  ) as Record<string | number, unknown>;
  base[head] = setIn(base[head], rest, value);
  return base as T;
}

export interface ParseResult {
  config: SignatureConfig | null;
  /** Field errors keyed by dotted path (`details.email`). */
  errors: Record<string, string>;
}

export function parseDraft(draft: Draft): ParseResult {
  const r = safeParseConfig(pruneEmpty(draft));
  if (r.success) return { config: r.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.');
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { config: null, errors };
}

/* ------------------------------------------------------------------ history */

export interface HistoryState {
  past: Draft[];
  present: Draft;
  future: Draft[];
  /** For coalescing rapid edits to the same field (typing) into one undo step. */
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 900;

export type Action =
  | { type: 'set'; path: Path; value: unknown; at?: number }
  | { type: 'update'; fn: (d: Draft) => Draft; at?: number }
  | { type: 'replace'; draft: Draft }
  | { type: 'undo' }
  | { type: 'redo' };

export function initHistory(draft: Draft): HistoryState {
  return { past: [], present: draft, future: [], lastKey: null, lastAt: 0 };
}

export function reduce(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'set': {
      const at = action.at ?? Date.now();
      const key = action.path.join('.');
      const next = setIn(state.present, action.path, action.value);
      const coalesce =
        state.lastKey === key && at - state.lastAt < COALESCE_MS && state.past.length > 0;
      const past = coalesce ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { past, present: next, future: [], lastKey: key, lastAt: at };
    }
    case 'update': {
      const next = action.fn(state.present);
      if (next === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'replace':
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.draft,
        future: [],
        lastKey: null,
        lastAt: 0,
      };
    case 'undo': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1]!;
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'redo': {
      if (!state.future.length) return state;
      const [next, ...future] = state.future;
      return {
        past: [...state.past, state.present],
        present: next!,
        future,
        lastKey: null,
        lastAt: 0,
      };
    }
  }
}
