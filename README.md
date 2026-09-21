# MailMotion

Open-source, self-hostable **animated email signatures** that actually render in Gmail, Outlook and
Apple Mail. Private by default: no tracking pixels, no accounts, no subscription.

- **Six designs**: Aurora, Portrait, Editorial, Wave, Neon, Equalizer, plus a layout x animation x
  signature-style system for remixing.
- **Email-safe output**: table-based HTML with inline styles, hosted GIF/PNG assets, frame 1 always
  complete, <= 10,000 characters, <= 300 KB per GIF, <= 12 fps.
- **Runs in your browser**: editing, GIF rendering and export happen client-side.
- **Two ways to host images**: your own storage (disk / S3 / R2 / MinIO) or one-click GitHub Pages.
- **CLI** for CI: `npx mailmotion render signature.json`.

> Status: building v1.0 "Community". See [`mailmotion-plan.md`](./mailmotion-plan.md).

## Repository layout

```
packages/   MIT      schema, serializer, renderer, presets, layouts, animations, icons, ink, contrast, storage
apps/       AGPL-3.0 web (Next.js builder), storage-server, publish-fn, cli, mock-github (dev tool)
docs/       guides and compatibility notes
```

See [`LICENSING.md`](./LICENSING.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`SECURITY.md`](./SECURITY.md).

## Development

```bash
corepack enable && pnpm install
pnpm test
pnpm --filter @mailmotion/web dev
```
