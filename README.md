<p align="center">
<img src="https://github.com/satiyaganes06/mailmotion/blob/main/apps/web/public/full-icon.png?raw=true" width = "306"  class="center"> </p>

# MailMotion

Open-source, self-hostable **animated email signatures** that render in Gmail, Outlook and Apple Mail.
Private by default: no tracking pixels, no accounts, no subscription.

<p align="center">
<video src="https://github.com/satiyaganes06/mailmotion/raw/main/apps/web/public/launch.mp4" controls width="720"></video>
</p>

<p align="center">
<a href="https://buymeacoffee.com/satiyaganes"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

- **Six designs** (Aurora, Portrait, Editorial, Wave, Neon, Equalizer) built from a layout x animation
  x signature-style system you can remix.
- **Email-safe output:** table-based HTML with inline styles and hosted GIF/PNG images. Frame 1 is always
  the complete design, HTML stays under 10,000 characters, each GIF under 300 KB and 12 fps.
- **Runs in your browser:** editing, GIF rendering and export happen client-side.
- **Signature marks:** typed (10 handwriting fonts), drawn with a pen pad, or traced from a scan.
- **Host images anywhere:** your own storage (disk / S3 / R2 / MinIO) or download a ZIP.
- **CLI for CI:** `npx mailmotion render signature.json --check`.

See [`docs/`](./docs) (also published at `/docs/` in the builder) and the original
[build plan](./mailmotion-plan.md).

## Status

v1.0 "Community" is implemented and tested, but **not yet verified on real mail clients or devices**
(see [`docs/compat/index.md`](./docs/compat/index.md) for the untested matrix), and the Docker images
have not been exercised in production from this repo's CI yet.

## Quick start

```bash
corepack enable
pnpm install
pnpm prepare        # renders the landing gallery, copies fonts
pnpm --filter @mailmotion/web dev     # http://localhost:3000
```

Self-host with Docker:

```bash
cp .env.example .env     # set MM_UPLOAD_TOKEN (openssl rand -hex 32)
docker compose up
```

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
