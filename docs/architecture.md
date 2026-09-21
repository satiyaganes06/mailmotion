---
title: Architecture
order: 9
---

# Architecture

```
packages/   MIT
  schema        zod config schema, limits, validators, portable JSON
  contrast      WCAG maths and accessible accent colours
  layouts       layout specs and the asset plan (which images, what size)
  presets       the six designs, palettes, remix
  serializer    config -> email-safe HTML, lint, budgets, .htm/.mailsignature
  animations    frame-drawing code for avatars, banners and logos (frame 0 is complete)
  ink           handwriting fonts, glyph outlines, pen tracing, stroke tracing (drawn/scanned)
  icons         social glyphs in four styles
  renderer      GIF/PNG encoding, budget ladder, Node + browser environments, bundles
  storage       adapters (disk, S3/R2/MinIO, HTTP, GitHub Pages) and the upload sanitizer
apps/       AGPL-3.0
  web           Next.js builder, landing and docs (static export)
  storage-server  Path A upload server
  publish-fn    GitHub token exchange (Workers or Node)
  mock-github   local stand-in for GitHub
  cli           npx mailmotion
```

**One code path.** The same serializer and renderer run in the browser (Web Worker), in Node (CLI, build-time gallery) and in tests, so the preview, the export and the CLI cannot drift.

**Flow.** config → `planAssets` → renderer draws each slot at 2x → content-hashed files → host → `serializeSignature` with the hosted URLs → HTML.

**Storage is an adapter.** A future cloud CDN is just another adapter.
