import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addCsp, buildCsp, inlineScriptHashes } from '../scripts/csp-lib.mjs';

const hash = (s: string) => createHash('sha256').update(s).digest('base64');

const page = `<!DOCTYPE html><html><head><meta charSet="utf-8"/><script src="/_next/static/a.js" async></script><script>self.__next_f.push([1,"hello"])</script><script id="x">window.a=1</script><script type="application/json">{"a":1}</script></head><body><script>console.log("</b>")</script></body></html>`;

describe('CSP for the static export', () => {
  it('hashes every executable inline script, and skips external and JSON ones', () => {
    const hs = inlineScriptHashes(page) as string[];
    expect(hs).toEqual([
      hash('self.__next_f.push([1,"hello"])'),
      hash('window.a=1'),
      hash('console.log("</b>")'),
    ]);
  });

  it('builds a policy that locks scripts to self + hashes and forbids objects/base/forms', () => {
    const csp = buildCsp({ inlineScriptHashes: ['AAA'] }) as string;
    expect(csp).toContain("script-src 'self' 'sha256-AAA'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it('injects the meta as the first child of <head>, once, and allows the analytics origin', () => {
    const once = addCsp(page, { extraScriptSrc: ['https://plausible.io'] }) as string;
    expect(once).toMatch(/<head><meta http-equiv="Content-Security-Policy"/);
    expect(once).toContain('https://plausible.io');
    expect(once).toContain(`'sha256-${hash('window.a=1')}'`);
    const twice = addCsp(once) as string;
    expect((twice.match(/Content-Security-Policy/g) ?? []).length).toBe(1);
  });

  it('leaves a document without <head> unchanged', () => {
    expect(addCsp('<p>x</p>')).toBe('<p>x</p>');
  });
});
