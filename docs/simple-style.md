---
title: Simple Style
order: 6.5
---

# Simple Style

Opening the builder ("Build my signature" or "Open builder") first asks **Simple Style** or
**Custom Style**. Both use the exact same renderer, upload flow and `.mailmotion.json` format —
picking one only decides how much of the builder you see. The choice is remembered in your
browser; the "← Change style" link inside either builder always re-asks.

- **Custom Style** is the original six designs and every field: palettes, socials, banners, a
  CTA button, badges, typography, drawn/uploaded signatures — see [Designs and limits](./designs.md).
- **Simple Style** is a second, separate catalogue of **ten** designs recreating a companion demo
  (Signet's ten-design set), with a single accent colour instead of a palette and a much smaller
  field set: full name, job title, and — only where the design actually uses them — company,
  phone, email, website, a tagline, or a status line.

## The ten designs

| Design        | Layout                              | Avatar               | Fields shown                     |
| ------------- | ----------------------------------- | -------------------- | -------------------------------- |
| Aurora ring   | Card (avatar, thin rule, details)   | Aurora ring, 88px    | company, phone, email, website   |
| Pulse         | Left Portrait (avatar, no rule)     | Pulse ring, 72px     | company, email, status line      |
| Typewriter    | Editorial, no avatar                | —                    | tagline (typed out)              |
| Wave banner   | Banner, no avatar                   | —                    | company, email, website          |
| Neon night    | Bordered, dark card background      | Neon glow, 72px      | company, email                   |
| Shimmer plate | Banner-top (strip leads), no avatar | —                    | company, email                   |
| Orbit         | Left Portrait (avatar, no rule)     | Orbit ring, 88px     | company, email, website          |
| News ticker   | Banner, no avatar                   | —                    | company, email, tagline          |
| Equalizer     | Left Portrait (avatar, no rule)     | Equalizer bars, 72px | company, email, tagline (italic) |
| Ink signature | Editorial, no avatar                | —                    | company, email                   |

Every design still ships an ink-drawn signature of the person's name (except Typewriter, Wave,
Shimmer and Ticker, which don't — the design's own animated element, not a second signature, is
the point there), still keeps frame 1 complete for classic Outlook, and still fits the same
10,000-character / 300KB / 12fps budgets as Custom Style.

## What's genuinely new vs. reused

Seven of the ten avatar/mark animations already existed (aurora, pulse, neon, orbit, equalizer,
ink, and the wave/ticker/shimmer banner strips were already built but unused by any Custom Style
preset). Only the **typewriter** banner animation (`packages/animations/src/banner.ts`) and the
**banner-top** layout (`packages/layouts/src/specs.ts`, `packages/serializer/src/compose.ts`) are
new. A design's accent-only colouring (`theme.contactSeparator: 'pipe'`, `extras.taglineStyle`)
are new schema fields shared with Custom Style, currently only ever set to non-default values by
Simple Style's presets.

## Known deviations from the source demo

- **Orbit's company eyebrow.** The source shows the company name in small caps _above_ the
  person's name. Every layout in this codebase renders the name first (it's the one row every
  design relies on), so the closest match is company immediately _after_ the name, not above it.
- **Aurora's ring gradient.** The source mixes the accent with two fixed extra hues in a 3-stop
  conic gradient. `avatar.ring` only supports a solid colour or a 2-stop gradient, and — more
  importantly — leaving it unset is what makes the _single_ accent picker reactive (see below), so
  Aurora's ring is solid.
- **The exact typing/scroll cadence** (typewriter's per-character timing, the ticker's scroll
  speed) is a reasonable approximation of the source's CSS keyframes, translated into a discrete
  GIF frame count — not a pixel-for-pixel timing match.

## Why the accent colour stays live

None of the ten presets sets `avatar.ring` or `mark.color` explicitly. Both fall back to
`theme.accent` at render time (`packages/renderer`'s `ringOf`/`renderMark`) unless a config sets
them, so Simple Style's one colour picker actually drives every design — change it, and the
avatar ring, the ink signature and every link colour update together, with no separate palette
step like Custom Style's.
