/** Formats for getting a signature into a mail client. */

/** Replace every non-ASCII character with a numeric entity so the file survives any encoding. */
export function asciiSafe(html: string): string {
  let out = '';
  for (const ch of html) {
    const cp = ch.codePointAt(0)!;
    out += cp > 126 ? `&#${cp};` : ch;
  }
  return out;
}

export interface ClipboardPayload {
  /** `text/html` flavour, for paste-based signature editors. */
  html: string;
  /** `text/plain` flavour (the HTML source). */
  text: string;
}

export function toClipboardPayload(html: string): ClipboardPayload {
  return { html, text: html };
}

/** A full HTML document for classic Outlook (`%APPDATA%\Microsoft\Signatures\<name>.htm`). */
export function toHtmDocument(html: string, title = 'Email signature'): string {
  const safeTitle = title.replace(/[<>&"']/g, '');
  return asciiSafe(
    `<!DOCTYPE html>\n<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title>${safeTitle}</title></head>\n<body>${html}</body></html>\n`,
  );
}

/**
 * The Apple Mail (macOS) `.mailsignature` format: MIME-style headers, a blank line, then HTML.
 * The installer flow (create a placeholder signature, quit Mail, replace the file, lock it) is in
 * the docs. `messageId` should be a UUID.
 */
export function toMailSignature(html: string, messageId: string): string {
  if (!/^[0-9A-Fa-f-]{8,64}$/.test(messageId))
    throw new Error('messageId must be a UUID-like string');
  const headers = [
    'Content-Transfer-Encoding: 7bit',
    'Content-Type: text/html;',
    '\tcharset=us-ascii',
    `Message-Id: <${messageId.toUpperCase()}>`,
    'Mime-Version: 1.0 (Mac OS X Mail 16.0 \\(3731.600.7\\))',
  ].join('\n');
  const body = `<body style="word-wrap: break-word; -webkit-nbsp-mode: space; line-break: after-white-space;">${html}</body>`;
  return `${headers}\n\n${asciiSafe(body)}\n`;
}

/** A filesystem-safe base name for downloads. */
export function fileBaseName(name: string | undefined, fallback = 'signature'): string {
  const base = (name ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  return base || fallback;
}
