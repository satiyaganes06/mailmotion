<p align="center">
  <img src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/full-icon.png" width="200" alt="MailMotion">
</p>

<h1 align="center">MailMotion</h1>
<p align="center"><i>Animated email signatures that actually render.</i></p>

<p align="center">
  Open-source, self-hostable animated email signatures for Gmail, Outlook and Apple Mail.<br>
  Private by default — no tracking pixels, no accounts, no subscription.
</p>

<p align="center">
  <a href="https://mailmotion-ten.vercel.app"><img src="https://img.shields.io/badge/demo-live-2a5db0?style=flat-square" alt="Live demo"></a>
  <a href="https://github.com/satiyaganes06/mailmotion/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/satiyaganes06/mailmotion/ci.yml?branch=main&style=flat-square&label=CI" alt="CI status"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/packages-MIT-3da639?style=flat-square" alt="MIT license"></a>
  <a href="./apps/LICENSE"><img src="https://img.shields.io/badge/apps-AGPL--3.0-blue?style=flat-square" alt="AGPL-3.0 license"></a>
  <a href="https://github.com/satiyaganes06/mailmotion/stargazers"><img src="https://img.shields.io/github/stars/satiyaganes06/mailmotion?style=flat-square" alt="GitHub stars"></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome"></a>
</p>

<p align="center">
  <a href="#demo">Demo</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#self-host-with-docker">Self-host</a> ·
  <a href="#support-the-project">Support</a> ·
  <a href="./docs">Docs</a>
</p>

<br>

## Demo

<p align="center">
  <a href="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/launch.mp4">
    <img src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/launch-poster.jpg" width="720" alt="MailMotion demo — click to play the video">
  </a>
</p>
<p align="center">
  <a href="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/launch.mp4"><img src="https://img.shields.io/badge/%E2%96%B6-Watch%20the%2024s%20demo-2a5db0?style=for-the-badge" alt="Watch the demo"></a>
</p>

<p align="center"><sub>Pick a design, add your details, copy into Gmail or Outlook. That's the whole workflow.</sub></p>

## Status

v1.0 "Community" is implemented and tested, but **not yet verified on real mail clients or devices**
(see [`docs/compat/index.md`](./docs/compat/index.md) for the untested matrix).

## Features

<table>
<tr>
<td width="33%" valign="top">

**16 ready-made designs**
Six fully customizable Custom Style layouts (Aurora, Portrait, Editorial, Wave, Neon, Equalizer) plus ten
pixel-identical Simple Style designs — just fill in your details and copy.

</td>
<td width="33%" valign="top">

**Email-safe by construction**
Table-based HTML with inline styles. Frame 1 is always the complete design, HTML stays under 10,000
characters, every GIF stays under 300 KB at 12 fps or less.

</td>
<td width="33%" valign="top">

**Runs entirely in your browser**
Editing, GIF rendering and export all happen client-side. Photos never leave your machine until you
choose to host them.

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Signature marks, three ways**
Typed in ten handwriting fonts, drawn with a pen pad, or traced from a scanned signature.

</td>
<td width="33%" valign="top">

**Host images anywhere**
Your own storage — disk, S3, R2, MinIO or Supabase — behind one `docker compose up`, or just download
a ZIP and host the files yourself.

</td>
<td width="33%" valign="top">

**CLI for CI**
`mailmotion render signature.json --check` renders and budget-checks a signature from JSON. Build it
from [`apps/cli`](./apps/cli) — not yet published to npm.

</td>
</tr>
</table>

See [`docs/`](./docs) (also published at `/docs/` in the builder) and the original
[build plan](./mailmotion-plan.md).

## Quick start

```bash
corepack enable
pnpm install
pnpm prepare        # renders the landing gallery, copies fonts
pnpm --filter @mailmotion/web dev     # http://localhost:3000
```

## Self-host with Docker

One command brings up the builder and an image storage server, both behind Caddy with automatic HTTPS:

```bash
cp .env.example .env     # set MM_UPLOAD_TOKEN (openssl rand -hex 32)
docker compose up -d
```

|                |                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Storage**    | disk (zero setup), or S3 / R2 / MinIO / Supabase — see [`docs/self-hosting.md`](./docs/self-hosting.md) |
| **HTTPS**      | automatic, via Caddy                                                                                    |
| **No server?** | download a ZIP from the builder, host the files anywhere, point the builder at your base URL            |

## Repository layout

```
packages/   MIT       schema, contrast, layouts, presets, serializer, animations, ink, icons, renderer, storage
apps/       AGPL-3.0  web (Next.js builder), storage-server, cli
docker/     Dockerfiles and Caddyfile
docs/       guides and the compatibility matrix
```

## Development

```bash
pnpm test           # unit + integration tests for every package
pnpm typecheck
pnpm format:check
NEXT_PUBLIC_UPLOAD_ENDPOINT=http://localhost:8787 \
NEXT_PUBLIC_UPLOAD_TOKEN=e2e-upload-token-0123456789abcdef \
  pnpm --filter @mailmotion/web build && pnpm e2e   # Playwright against the production build
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) (DCO sign-off), [`LICENSING.md`](./LICENSING.md) and
[`SECURITY.md`](./SECURITY.md).

## Support the project

MailMotion is free, open source and self-hosted — no subscription, no paywall. If it saved you some
time, a coffee goes a long way.

<p align="center">
  <a href="https://buymeacoffee.com/satiyaganes"><img src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/stickers/creator-text.png" height="52" alt=""></a>
  <a href="https://buymeacoffee.com/satiyaganes"><img src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/stickers/cup-large.png" height="78" alt=""></a>
  <a href="https://buymeacoffee.com/satiyaganes"><img src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/stickers/heart.png" height="52" alt=""></a>
  <a href="https://buymeacoffee.com/satiyaganes"><img src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/stickers/badge-yellow.png" height="66" alt=""></a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/satiyaganes"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

<br>

<p align="center">
  <sub>Built by <a href="https://github.com/satiyaganes06">Shatthiya Ganes</a> · engine is MIT, apps are AGPL-3.0 — see <a href="./LICENSING.md">LICENSING.md</a></sub>
</p>
