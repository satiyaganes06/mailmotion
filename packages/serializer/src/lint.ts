export interface LintIssue {
  rule: string;
  message: string;
}

export interface LintOptions {
  /** Allow blob:/localhost image sources (live preview only). */
  allowLocalPreview?: boolean;
}

const ALLOWED_TAGS = new Set([
  'table',
  'tbody',
  'tr',
  'td',
  'a',
  'img',
  'br',
  'span',
  'strong',
  'em',
  'b',
  'i',
]);
const FORBIDDEN_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'form',
  'input',
  'button',
  'svg',
  'video',
  'audio',
  'base',
  'canvas',
  'math',
  'template',
  'noscript',
  'textarea',
  'select',
];

/**
 * Structural lint over serializer output. It parses the tiny HTML subset the serializer emits and
 * flags anything outside it, so an XSS or tracking regression fails loudly in CI.
 */
export function lintHtml(html: string, opts: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (rule: string, message: string) => issues.push({ rule, message });

  for (const tag of FORBIDDEN_TAGS) {
    if (new RegExp(`<\\s*/?\\s*${tag}[\\s>/]`, 'i').test(html))
      add('forbidden-tag', `<${tag}> is not allowed`);
  }
  if (/<!--/.test(html)) add('comment', 'HTML comments are not allowed');

  // Every tag must match the strict shape: lower-case name, double-quoted attributes only.
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9]*)([^<>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const name = m[1]!.toLowerCase();
    const rest = m[2] ?? '';
    if (!ALLOWED_TAGS.has(name)) {
      if (!FORBIDDEN_TAGS.includes(name)) add('unknown-tag', `<${name}> is not in the allowed set`);
      continue;
    }
    if (m[0]!.startsWith('</')) continue;
    const attrRe = /^(?:\s+([a-z][a-z-]*)="([^"]*)")*\s*\/?$/;
    if (!attrRe.test(rest)) {
      add('malformed-tag', `Malformed attributes on <${name}>`);
      continue;
    }
    const attrs = [...rest.matchAll(/\s+([a-z][a-z-]*)="([^"]*)"/g)];
    for (const [, an, av] of attrs) {
      const decoded = decodeEntities(av!);
      if (/^on/.test(an!)) add('event-handler', `Event handler ${an} on <${name}>`);
      if ((an === 'href' || an === 'src') && /^\s*(javascript|vbscript)\s*:/i.test(decoded)) {
        add('js-url', `javascript:/vbscript: in ${an} on <${name}>`);
      }
      if (an === 'style' && /@import|expression\s*\(|behavior\s*:|-moz-binding/i.test(decoded)) {
        add('css-injection', 'Dangerous CSS in style attribute');
      }
      if (an === 'href') {
        const v = decodeEntities(av!);
        if (!/^(https:\/\/|mailto:|tel:\+)/i.test(v))
          add('href-scheme', `Disallowed href scheme: ${v.slice(0, 30)}`);
      }
      if (an === 'src') {
        const v = decodeEntities(av!);
        const local =
          opts.allowLocalPreview && /^(blob:|http:\/\/(localhost|127\.0\.0\.1))/i.test(v);
        if (!/^https:\/\//i.test(v) && !local)
          add('src-scheme', `Image src must be https: ${v.slice(0, 30)}`);
        if (/^data:/i.test(v)) add('data-uri', 'data: images are stripped by Gmail');
      }
      if (an === 'style' && /url\s*\(/i.test(decoded))
        add('css-url', 'CSS url() is not allowed (Gmail strips it; it can also track)');
    }
    if (name === 'img') {
      const w = Number(/\swidth="(\d+)"/.exec(rest)?.[1] ?? '0');
      const h = Number(/\sheight="(\d+)"/.exec(rest)?.[1] ?? '0');
      if (w <= 2 || h <= 2)
        add('tracking-pixel', 'Images at or below 2px are treated as tracking pixels');
      if (!/\salt="/.test(rest)) add('img-alt', '<img> is missing alt text');
    }
  }
  return issues;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
