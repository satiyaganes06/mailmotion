# MailMotion

Open-source, self-hostable **animated email signatures** that render in Gmail, Outlook and Apple Mail.
Private by default: no tracking pixels, no accounts, no subscription.

- **Six designs** (Aurora, Portrait, Editorial, Wave, Neon, Equalizer) built from a layout x animation
  x signature-style system you can remix.
- **Email-safe output:** table-based HTML with inline styles and hosted GIF/PNG images. Frame 1 is always
  the complete design, HTML stays under 10,000 characters, each GIF under 300 KB and 12 fps.
- **Runs in your browser:** editing, GIF rendering and export happen client-side.
- **Signature marks:** typed (10 handwriting fonts), drawn with a pen pad, or traced from a scan.
- **Two ways to host images:** your own storage (disk / S3 / R2 / MinIO) or one-click GitHub Pages.
- **CLI for CI:** `npx mailmotion render signature.json --check`.

See [`docs/`](./docs) (also published at `/docs/` in the builder) and the original
[build plan](./mailmotion-plan.md).

## Status

v1.0 "Community" is implemented and tested, but **not yet verified on real mail clients or devices**
(see [`docs/compat/index.md`](./docs/compat/index.md) for the untested matrix), and the Docker images and
the real GitHub App flow have not been exercised against github.com from this repo's CI yet.

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
apps/       AGPL-3.0  web (Next.js builder), storage-server, publish-fn, mock-github (dev), cli
docker/     Dockerfiles and Caddyfile
docs/       guides and the compatibility matrix
```

## Development

```bash
pnpm test           # unit + integration tests for every package
pnpm typecheck
pnpm format:check
pnpm --filter @mailmotion/web build && pnpm e2e    # Playwright against the production build
```

Trying the GitHub Pages flow without registering a GitHub App: see
[`docs/github-pages.md`](./docs/github-pages.md) (uses `apps/mock-github`).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) (DCO sign-off), [`LICENSING.md`](./LICENSING.md) and
[`SECURITY.md`](./SECURITY.md).
