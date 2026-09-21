import { describe, expect, it } from 'vitest';
import { createFromPreset } from '@mailmotion/presets';
import { serializeWithPlaceholders } from '@mailmotion/serializer';
import { buildTestEml } from '../src/lib/eml';
import {
  PHONE_TTL_MS,
  QR_MAX_CHARS,
  checkHtml,
  decodePhonePayload,
  detectPlatform,
  encodePhonePayload,
  phoneServerUrl,
  phoneUrl,
} from '../src/lib/phone-link';
import { GUIDES } from '../src/lib/guides';

const html = () =>
  serializeWithPlaceholders(createFromPreset('aurora', { fullName: 'Ada Lovelace' })).html;

describe('phone link', () => {
  it('round-trips a real signature', async () => {
    const h = html();
    const enc = await encodePhonePayload(h, 1000);
    const dec = await decodePhonePayload(enc, 2000);
    expect(dec).toEqual({ ok: true, html: h, expiresAt: 1000 + PHONE_TTL_MS });
  });
  it('is compact enough for a QR code for a typical signature', async () => {
    const enc = await encodePhonePayload(html());
    expect(phoneUrl('https://mailmotion.app', enc).length).toBeLessThan(QR_MAX_CHARS);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('expires after 24 hours', async () => {
    const enc = await encodePhonePayload(html(), 1000);
    expect(await decodePhonePayload(enc, 1000 + PHONE_TTL_MS - 1)).toMatchObject({ ok: true });
    expect(await decodePhonePayload(enc, 1000 + PHONE_TTL_MS)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
  it('rejects corrupted, non-payload and truncated links', async () => {
    const enc = await encodePhonePayload(html());
    expect(await decodePhonePayload('not-base64!!')).toEqual({ ok: false, reason: 'invalid' });
    expect(await decodePhonePayload(enc.slice(0, 40))).toEqual({ ok: false, reason: 'invalid' });
    expect(await decodePhonePayload('')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('refuses HTML that the serializer could not have produced (XSS)', async () => {
    for (const evil of [
      '<script>alert(1)</script>',
      '<a href="javascript:alert(1)">x</a>',
      '<img src="https://a/b.gif" width="10" height="10" alt="" onerror="x()" />',
      '<iframe src="https://evil"></iframe>',
      'x'.repeat(70_000),
    ]) {
      const enc = await encodePhonePayload(evil);
      expect(await decodePhonePayload(enc), evil.slice(0, 30)).toEqual({
        ok: false,
        reason: 'unsafe',
      });
    }
    expect(checkHtml(html(), 1)).toMatchObject({ ok: true });
  });
  it('builds server-backed links and detects the phone platform', () => {
    expect(phoneServerUrl('https://a.example', 'https://img.example.com', 'abc')).toBe(
      'https://a.example/phone/?api=https%3A%2F%2Fimg.example.com&t=abc',
    );
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('other');
  });
});

describe('test email (.eml)', () => {
  const decodeBody = (eml: string) => {
    const body = eml.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
    return Buffer.from(body, 'base64').toString('utf8');
  };
  it('is a valid draft-style message that contains the signature and non-ASCII text', () => {
    const sig = `${html()}`.replace('Ada Lovelace', 'Zoë 日本');
    const eml = buildTestEml(sig, {
      subject: 'Tëst – signature',
      now: new Date('2026-01-02T03:04:05Z'),
    });
    expect(eml).toContain('X-Unsent: 1');
    expect(eml).toContain('MIME-Version: 1.0');
    expect(eml).toContain('Content-Type: text/html; charset=UTF-8');
    expect(eml).toContain('Content-Transfer-Encoding: base64');
    expect(eml).toContain('Date: Fri, 02 Jan 2026 03:04:05 +0000');
    const subj = /Subject: =\?UTF-8\?B\?(.+)\?=/.exec(eml)![1]!;
    expect(Buffer.from(subj, 'base64').toString('utf8')).toBe('Tëst – signature');
    expect(decodeBody(eml)).toContain('Zoë 日本');
    for (const line of eml.split('\r\n')) expect(line.length).toBeLessThanOrEqual(998);
  });
  it('cannot be header-injected through the subject', () => {
    const eml = buildTestEml('<table></table>', { subject: 'hi\r\nBcc: evil@example.com' });
    expect(eml).not.toMatch(/^Bcc:/m);
  });
});

describe('install guides', () => {
  it('cover every client family and every method, each with steps', () => {
    expect(new Set(GUIDES.map((g) => g.family))).toEqual(
      new Set(['Gmail', 'Outlook', 'Apple Mail']),
    );
    expect(new Set(GUIDES.map((g) => g.method))).toEqual(
      new Set(['copy', 'htm', 'mailsignature', 'phone']),
    );
    for (const g of GUIDES) expect(g.steps.length).toBeGreaterThanOrEqual(2);
  });
});
