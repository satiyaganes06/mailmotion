import { describe, expect, it } from 'vitest';
import {
  COALESCE_MS,
  getIn,
  initHistory,
  parseDraft,
  pruneEmpty,
  reduce,
  setIn,
  type Draft,
} from '../src/lib/draft';

describe('pruneEmpty', () => {
  it('drops empty strings/undefined/null recursively but keeps zeros, false and arrays', () => {
    expect(
      pruneEmpty({
        a: '',
        b: 0,
        c: false,
        d: [{ e: '', f: 'x' }],
        g: null,
        h: undefined,
        i: { j: '' },
      }),
    ).toEqual({ b: 0, c: false, d: [{ f: 'x' }], i: {} });
  });
});

describe('setIn / getIn', () => {
  it('sets immutably and creates missing containers', () => {
    const a: Draft = { details: { fullName: 'A' } };
    const b = setIn(a, ['details', 'title'], 'Eng');
    expect(a).toEqual({ details: { fullName: 'A' } });
    expect(b).toEqual({ details: { fullName: 'A', title: 'Eng' } });
    expect(setIn({}, ['socials', 'items', 1, 'url'], 'u')).toEqual({
      socials: { items: [undefined, { url: 'u' }] },
    });
    expect(getIn(b, ['details', 'title'])).toBe('Eng');
    expect(getIn(b, ['nope', 'x'])).toBeUndefined();
  });
  it('keeps unrelated branches referentially equal (cheap re-renders)', () => {
    const a = { x: { y: 1 }, z: { w: 2 } };
    const b = setIn(a, ['x', 'y'], 5);
    expect(b.z).toBe(a.z);
  });
});

describe('parseDraft', () => {
  it('returns a filled config for a valid draft', () => {
    const r = parseDraft({ details: { fullName: 'Ada' } });
    expect(r.config?.details.fullName).toBe('Ada');
    expect(r.errors).toEqual({});
  });
  it('reports field errors by dotted path without throwing', () => {
    const r = parseDraft({
      details: { fullName: 'Ada', email: 'nope' },
      typography: { bodySize: 8 },
    });
    expect(r.config).toBeNull();
    expect(r.errors['details.email']).toMatch(/valid email/);
    expect(r.errors['typography.bodySize']).toBeTruthy();
  });
  it('treats blank optional fields as absent', () => {
    expect(
      parseDraft({ details: { fullName: 'Ada', title: '', email: '' } }).config,
    ).not.toBeNull();
  });
  it('requires a name', () => {
    const r = parseDraft({ details: { fullName: '' } });
    expect(r.errors['details.fullName']).toBeTruthy();
  });
});

describe('history', () => {
  const set = (
    s: ReturnType<typeof initHistory>,
    v: string,
    at: number,
    path = ['details', 'fullName'],
  ) => reduce(s, { type: 'set', path, value: v, at });

  it('undo and redo walk the history', () => {
    let s = initHistory({ n: 0 });
    s = reduce(s, { type: 'update', fn: () => ({ n: 1 }) });
    s = reduce(s, { type: 'update', fn: () => ({ n: 2 }) });
    s = reduce(s, { type: 'undo' });
    expect(s.present).toEqual({ n: 1 });
    s = reduce(s, { type: 'undo' });
    expect(s.present).toEqual({ n: 0 });
    expect(reduce(s, { type: 'undo' })).toBe(s); // nothing left
    s = reduce(s, { type: 'redo' });
    expect(s.present).toEqual({ n: 1 });
  });

  it('a new edit clears the redo stack', () => {
    let s = initHistory({ n: 0 });
    s = reduce(s, { type: 'update', fn: () => ({ n: 1 }) });
    s = reduce(s, { type: 'undo' });
    s = reduce(s, { type: 'update', fn: () => ({ n: 9 }) });
    expect(s.future).toEqual([]);
  });

  it('coalesces rapid typing in the same field into one undo step', () => {
    let s = initHistory({ details: { fullName: '' } });
    s = set(s, 'A', 1000);
    s = set(s, 'Ad', 1200);
    s = set(s, 'Ada', 1400);
    expect(s.past).toHaveLength(1);
    s = reduce(s, { type: 'undo' });
    expect(getIn(s.present, ['details', 'fullName'])).toBe('');
  });

  it('does not coalesce across fields or after a pause', () => {
    let s = initHistory({ details: {} });
    s = set(s, 'A', 1000);
    s = set(s, 'B', 1100, ['details', 'title']);
    s = set(s, 'C', 1100 + COALESCE_MS + 1, ['details', 'title']);
    expect(s.past).toHaveLength(3);
  });

  it('caps history length', () => {
    let s = initHistory({ n: 0 });
    for (let i = 1; i <= 150; i++) s = reduce(s, { type: 'update', fn: () => ({ n: i }) });
    expect(s.past.length).toBeLessThanOrEqual(100);
  });

  it('replace is undoable', () => {
    let s = initHistory({ a: 1 });
    s = reduce(s, { type: 'replace', draft: { a: 2 } });
    expect(reduce(s, { type: 'undo' }).present).toEqual({ a: 1 });
  });
});
