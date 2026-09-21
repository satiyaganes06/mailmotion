/** Browser download and clipboard helpers. */

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(name: string, text: string, type = 'text/plain'): void {
  downloadBlob(name, new Blob([text], { type: `${type};charset=utf-8` }));
}

/**
 * Copy HTML as *formatted* content (`text/html`), so it pastes as a rich signature into Gmail and
 * Outlook signature editors. Uses the async Clipboard API, falling back to selecting a rendered
 * copy and `execCommand('copy')` (Safari/Firefox quirks).
 */
export async function copyRichHtml(html: string): Promise<boolean> {
  try {
    if (navigator.clipboard && 'ClipboardItem' in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through */
  }
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
  holder.innerHTML = html; // our own serializer output (lint-checked), never user-supplied markup
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  sel?.removeAllRanges();
  holder.remove();
  return ok;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
