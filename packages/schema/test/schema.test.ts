import { describe, expect, it } from 'vitest';
import {
  createConfig,
  exportConfig,
  importConfig,
  isEmail,
  normalizeHex,
  resolveVariant,
  safeParseConfig,
  toE164,
  toHttpsUrl,
  validateSocialUrl,
} from '../src';

describe('validators', () => {
  it('normalises hex colours', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(() => normalizeHex('red')).toThrow();
  });
  it('accepts only https URLs', () => {
    expect(toHttpsUrl('example.com')).toBe('https://example.com/');
    expect(toHttpsUrl('http://example.com')).toBeNull();
    expect(toHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(toHttpsUrl('data:text/html,hi')).toBeNull();
    expect(toHttpsUrl('https://user:pw@example.com')).toBeNull();
    expect(toHttpsUrl('https://exa mple.com')).toBeNull();
    expect(toHttpsUrl('https://localhost')).toBeNull();
  });
  it('normalises phone numbers to E.164', () => {
    expect(toE164('+60 12-345 6789')).toBe('+60123456789');
    expect(toE164('012 345 6789')).toBeNull();
    expect(toE164('+12')).toBeNull();
  });
  it('validates emails', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a b@c.com')).toBe(false);
    expect(isEmail('"x"@c.com')).toBe(false);
  });
  it('validates social URLs per platform', () => {
    expect(validateSocialUrl('linkedin', 'https://www.linkedin.com/in/x').ok).toBe(true);
    expect(validateSocialUrl('linkedin', 'https://evil.com/linkedin.com').ok).toBe(false);
    expect(validateSocialUrl('github', 'https://notgithub.com/x').ok).toBe(false);
    expect(validateSocialUrl('custom', 'https://anything.example').ok).toBe(true);
    expect(validateSocialUrl('whatsapp', 'https://wa.me/60123456789').ok).toBe(true);
  });
});

describe('signatureConfigSchema', () => {
  it('fills defaults from just a name', () => {
    const c = createConfig({ details: { fullName: 'Ada Lovelace' } });
    expect(c.schemaVersion).toBe(1);
    expect(c.avatar.size).toBe('M');
    expect(c.layout.id).toBe('card');
    expect(c.theme.accent).toBe('#b34700');
    expect(c.details.fieldOrder).toContain('phones');
    expect(c.typography.bodySize).toBeGreaterThanOrEqual(12);
  });
  it('rejects body font sizes below 12px', () => {
    const r = safeParseConfig({ details: { fullName: 'A' }, typography: { bodySize: 11 } });
    expect(r.success).toBe(false);
  });
  it('enforces field length limits', () => {
    expect(safeParseConfig({ details: { fullName: 'x'.repeat(61) } }).success).toBe(false);
    expect(safeParseConfig({ details: { fullName: 'A', pronouns: 'x'.repeat(21) } }).success).toBe(
      false,
    );
    expect(safeParseConfig({ details: { fullName: 'A', tagline: 'x'.repeat(91) } }).success).toBe(
      false,
    );
  });
  it('caps phones at 3, websites at 2, custom fields at 3, badges at 4', () => {
    const ph = { label: 'm', number: '+60123456789' };
    expect(safeParseConfig({ details: { fullName: 'A', phones: [ph, ph, ph, ph] } }).success).toBe(
      false,
    );
    expect(
      safeParseConfig({
        details: { fullName: 'A', websites: [1, 2, 3].map((i) => ({ url: `https://e${i}.com` })) },
      }).success,
    ).toBe(false);
  });
  it('rejects non-https website and social URLs', () => {
    expect(
      safeParseConfig({ details: { fullName: 'A', websites: [{ url: 'javascript:alert(1)' }] } })
        .success,
    ).toBe(false);
    expect(
      safeParseConfig({
        details: { fullName: 'A' },
        socials: { items: [{ platform: 'linkedin', url: 'https://example.com/x' }] },
      }).success,
    ).toBe(false);
  });
  it('rejects SVG image data URLs (script vector)', () => {
    expect(
      safeParseConfig({
        details: { fullName: 'A' },
        avatar: { image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
      }).success,
    ).toBe(false);
  });
  it('accepts png data URLs', () => {
    expect(
      safeParseConfig({
        details: { fullName: 'A' },
        avatar: { image: 'data:image/png;base64,iVBORw0KGgo=' },
      }).success,
    ).toBe(true);
  });
});

describe('variants', () => {
  it('reply variant hides banner, cta, disclaimer and mark by default', () => {
    const base = createConfig({ details: { fullName: 'A' } });
    const reply = resolveVariant(base, 'reply');
    expect(reply.layout.sections.banner).toBe(false);
    expect(reply.layout.sections.cta).toBe(false);
    expect(reply.layout.sections.disclaimer).toBe(false);
    expect(reply.layout.sections.avatar).toBe(true);
    expect(reply.layout.sections.social).toBe(true);
    expect(base.layout.sections.banner).toBe(true); // not mutated
  });
  it('full variant is the identity', () => {
    const base = createConfig({ details: { fullName: 'A' } });
    expect(resolveVariant(base, 'full')).toBe(base);
  });
});

describe('portable JSON', () => {
  it('round-trips', () => {
    const c = createConfig({ details: { fullName: 'Grace Hopper', title: 'Rear Admiral' } });
    const r = importConfig(exportConfig(c));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(c);
  });
  it('accepts a bare config and rejects unknown versions and junk', () => {
    expect(importConfig(JSON.stringify({ details: { fullName: 'A' } })).ok).toBe(true);
    expect(importConfig(JSON.stringify({ schemaVersion: 99, details: { fullName: 'A' } })).ok).toBe(
      false,
    );
    expect(importConfig('not json').ok).toBe(false);
    expect(importConfig('[]').ok).toBe(false);
    expect(importConfig(JSON.stringify({ details: {} })).ok).toBe(false);
  });
});
