import { describe, expect, it } from 'vitest';
import { createConfig, LIMITS } from '@mailmotion/schema';
import {
  analyzeSignature,
  asciiSafe,
  charStatus,
  contrastIssues,
  fileBaseName,
  fitBudget,
  serializeWithPlaceholders,
  toHtmDocument,
  toMailSignature,
} from '../src';
import { sampleFor } from './fixtures';

const bloated = () => {
  const base = sampleFor('aurora');
  const items = [
    'linkedin',
    'github',
    'x',
    'instagram',
    'facebook',
    'youtube',
    'tiktok',
    'medium',
    'behance',
    'dribbble',
  ].map((p) => ({
    platform: p as never,
    url: `https://${p === 'behance' ? 'behance.net' : p + '.com'}/someone`,
  }));
  return createConfig({
    ...base,
    socials: { ...base.socials, items },
    extras: { ...base.extras, disclaimer: 'Confidential. '.repeat(55), greenNote: true },
    details: { ...base.details, tagline: 'x'.repeat(90) },
  } as never);
};

describe('charStatus', () => {
  it('ok below 8500, warn from 8500, over above 10000', () => {
    expect(charStatus(8_499)).toBe('ok');
    expect(charStatus(8_500)).toBe('warn');
    expect(charStatus(10_000)).toBe('warn');
    expect(charStatus(10_001)).toBe('over');
  });
});

describe('analyzeSignature', () => {
  it('a normal signature is ok and can export to Gmail', () => {
    const a = analyzeSignature(sampleFor('aurora'));
    expect(a.charStatus).toBe('ok');
    expect(a.canExportGmail).toBe(true);
    expect(a.fixes).toEqual([]);
  });
  it('warns about more than 7 icons', () => {
    const a = analyzeSignature(bloated());
    expect(a.warnings.some((w) => /social icons/.test(w))).toBe(true);
  });
  it('flags over-limit signatures and offers ordered fixes that each save characters', () => {
    const c = bloated();
    const tiny = fitBudget(c, { limit: 3000 });
    expect(tiny.applied.length).toBeGreaterThan(0);
    const a = analyzeSignature(c);
    for (const f of a.fixes) {
      expect(serializeWithPlaceholders(f.apply(c)).chars).toBeLessThan(a.chars);
    }
  });
});

describe('fitBudget', () => {
  it('leaves a signature that already fits untouched', () => {
    const c = sampleFor('aurora');
    const r = fitBudget(c);
    expect(r.applied).toEqual([]);
    expect(r.config).toBe(c);
    expect(r.fits).toBe(true);
  });
  it('applies text-links first, and stops as soon as it fits', () => {
    const c = bloated();
    const before = serializeWithPlaceholders(c).chars;
    const r = fitBudget(c, { limit: before - 500 });
    expect(r.applied[0]).toBe('text-links');
    expect(r.chars).toBeLessThanOrEqual(before - 500);
    expect(r.fits).toBe(true);
  });
  it('gets a maximally loaded signature under the Gmail limit', () => {
    const c = bloated();
    const r = fitBudget(c);
    expect(r.chars).toBeLessThanOrEqual(LIMITS.htmlChars);
  });
});

describe('contrastIssues', () => {
  it('reports a too-light accent with a suggested replacement that passes', () => {
    const base = sampleFor('aurora');
    const c = createConfig({ ...base, theme: { ...base.theme, accent: '#ffe066' } } as never);
    const issues = contrastIssues(c);
    expect(issues[0]).toMatchObject({ field: 'accent', problem: 'light' });
    expect(issues[0]!.suggested).not.toBe('#ffe066');
  });
  it('warns when an accent is nearly invisible on dark backgrounds', () => {
    const base = sampleFor('aurora');
    const c = createConfig({ ...base, theme: { ...base.theme, accent: '#0b0b1a' } } as never);
    expect(contrastIssues(c).some((i) => i.field === 'accent' && i.problem === 'dark')).toBe(true);
  });
  it('is quiet for the default theme', () => {
    expect(contrastIssues(sampleFor('aurora'))).toEqual([]);
  });
});

describe('exports', () => {
  it('asciiSafe converts non-ASCII, including astral characters', () => {
    expect(asciiSafe('é日😀')).toBe('&#233;&#26085;&#128512;');
  });
  it('htm document is complete and ASCII-only', () => {
    const doc = toHtmDocument('<table><tr><td>Zoë</td></tr></table>', 'My <sig>');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('Zo&#235;');
    expect(doc).not.toContain('<sig>');
    expect([...doc].every((ch) => ch.codePointAt(0)! < 128)).toBe(true);
  });
  it('mailsignature has MIME headers, a blank line and the html body', () => {
    const f = toMailSignature('<table></table>', 'a1b2c3d4-0000-4000-8000-123456789abc');
    const [head, body] = f.split('\n\n');
    expect(head).toContain('Content-Type: text/html;');
    expect(head).toContain('charset=us-ascii');
    expect(head).toContain('Message-Id: <A1B2C3D4-0000-4000-8000-123456789ABC>');
    expect(body).toContain('<table></table>');
    expect(() => toMailSignature('x', 'not a uuid!')).toThrow();
  });
  it('fileBaseName makes safe names', () => {
    expect(fileBaseName('Ada Lovelace!')).toBe('ada-lovelace');
    expect(fileBaseName('../../etc/passwd')).toBe('etcpasswd');
    expect(fileBaseName('')).toBe('signature');
  });
});
