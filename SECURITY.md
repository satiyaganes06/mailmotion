# Security Policy

MailMotion processes user images and produces HTML that is pasted into other people's inboxes, so
security reports are welcome and taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting
("Security" tab -> "Report a vulnerability") on this repository. We aim to acknowledge reports within
3 business days and to ship a fix or mitigation within 30 days for confirmed issues.

## Scope highlights

- HTML/XSS in serializer output (`packages/serializer`)
- Upload validation and file handling (`apps/storage-server`)
- GitHub token handling and the token-exchange function (`apps/publish-fn`)
- Anything that leaks tokens, or lets a request reach private network addresses

## Design commitments

- The GitHub user token lives in browser memory only; it is never persisted or logged.
- Uploads are allow-listed, size- and pixel-capped, magic-byte checked and sanitized.
- The builder ships a strict Content-Security-Policy.
- No tracking pixels, no open tracking, and analytics are cookieless.
