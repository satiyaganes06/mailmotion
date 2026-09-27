import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DESIGNS, exportHtml, normalize, previewHtml, type SignetData } from '../src';
import { loadReference, referenceRender } from './reference';

const ref = loadReference();

/** The reference page's own default form values. */
const SAMPLE: SignetData = {
  name: 'Aina Rahman',
  title: 'Product Designer',
  company: 'Lumen Labs',
  phone: '+60 12 345 6789',
  email: 'aina@lumenlabs.io',
  website: 'lumenlabs.io',
  tagline: 'Designing calmer fintech apps',
  status: 'Available for calls this week',
};
const BASE = 'https://cdn.example.com/signatures';

function expectSame(d: SignetData, a: string) {
  for (const design of DESIGNS) {
    const r = referenceRender(ref, design.id, { ...d }, a, BASE);
    expect(previewHtml(design, d, a), `${design.id} preview`).toBe(r.preview);
    expect(exportHtml(design, d, a, `${BASE}/${design.id}.gif`), `${design.id} export`).toBe(
      r.exported,
    );
  }
}

describe('Simple Style templates are the Signet reference, byte for byte', () => {
  it('has the same ten designs, names, descriptions and GIF sizes, in the same order', () => {
    expect(DESIGNS.map((x) => [x.id, x.name, x.use, x.w, x.h])).toEqual(
      ref.designs.map((x) => [x.id, x.name, x.use, x.w, x.h]),
    );
  });

  it('matches for the reference page’s default details', () => {
    expectSame(SAMPLE, '#2A5DB0');
  });

  it('matches with empty fields, a long name, and characters that need escaping', () => {
    expectSame({ ...SAMPLE, phone: '', website: '', title: '' }, '#c8372d');
    expectSame({ ...SAMPLE, name: 'Maximilian Alexander von Hohenberg' }, '#2A5DB0');
    expectSame(
      {
        ...SAMPLE,
        name: `O'Brien & <Sons> "Ltd"`,
        company: `Tom & Jerry's <b>`,
        tagline: 'x'.repeat(80),
        website: 'https://example.com/',
      },
      '#123456',
    );
    expectSame(
      {
        name: '',
        title: '',
        company: '',
        phone: '',
        email: '',
        website: '',
        tagline: '',
        status: '',
      },
      '#2A5DB0',
    );
  });

  it('matches for arbitrary input', () => {
    const text = fc.string({ maxLength: 60 });
    fc.assert(
      fc.property(
        fc.record({
          name: text,
          title: text,
          company: text,
          phone: text,
          email: text,
          website: text,
          tagline: text,
          status: text,
        }),
        fc
          .tuple(fc.integer({ min: 0, max: 0xffffff }))
          .map(([n]) => `#${n.toString(16).padStart(6, '0')}`),
        (raw, accent) => {
          const d = normalize({ ...raw, accent });
          expectSame(d, d.accent);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('normalizes like the reference form: trims every field and rejects a bad accent', () => {
    const d = normalize({ ...SAMPLE, name: '  Aina  ', accent: 'blue' });
    expect(d.name).toBe('Aina');
    expect(d.accent).toBe('#2A5DB0');
    expect(normalize({ accent: '#abcdef' }).accent).toBe('#abcdef');
  });
});
