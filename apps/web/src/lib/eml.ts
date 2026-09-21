/**
 * Build a test message as an `.eml` file. Double-clicking it opens the message in Outlook (as an
 * editable draft, thanks to `X-Unsent: 1`), Apple Mail and most desktop clients, so people can
 * send it to themselves and check how the signature arrives. Images stay hosted (no attachments).
 */
export function buildTestEml(
  signatureHtml: string,
  opts: { subject?: string; now?: Date; boundaryId?: string } = {},
): string {
  const subject = (opts.subject ?? 'Testing my new email signature')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 120);
  const date = (opts.now ?? new Date()).toUTCString().replace('GMT', '+0000');
  const body = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">
<p>Hi,</p><p>This is a test message to see how my new signature looks. Please ignore it.</p><p>Best,</p>
${signatureHtml}
</body></html>`;
  const b64 = utf8ToBase64(body).replace(/(.{76})/g, '$1\r\n');
  return [
    'X-Unsent: 1',
    `Subject: =?UTF-8?B?${utf8ToBase64(subject)}?=`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64,
    '',
  ].join('\r\n');
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
