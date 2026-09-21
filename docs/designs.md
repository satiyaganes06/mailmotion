---
title: Designs and limits
order: 6
---

# Designs and limits

MailMotion ships six designs. Each one is a preset: a **layout**, an **avatar animation**, an **ink signature** style and a default theme. Any part can be changed or swapped ("remix").

| Design    | Layout        | Avatar                               | Frame 1 (classic Outlook) | Best for                   |
| --------- | ------------- | ------------------------------------ | ------------------------- | -------------------------- |
| Aurora    | Card          | Ring draws around the avatar         | Ring complete, name inked | Anyone                     |
| Portrait  | Left portrait | Diagonal strip reveal                | Photo fully revealed      | Personal brands            |
| Editorial | Editorial     | Pulse ring                           | Solid avatar, name inked  | Writers, lawyers, founders |
| Wave      | Banner        | Orbiting gradient ring + wave banner | Ring and banner complete  | Brand-led teams            |
| Neon      | Bordered      | Neon glow pulse                      | Mark lit                  | Creative studios           |
| Equalizer | Stacked       | Bouncing bars                        | Bars at rest, name inked  | Podcasters, mobile-first   |

## How email-safe output is guaranteed

- **Tables and inline styles** only; no `<style>`, `<script>`, SVG or data URIs.
- **Images** are hosted GIF/PNG, rendered at 2x and shown at 1x. Circle and rounded shapes are baked into the image (Outlook ignores `border-radius`).
- **Frame 1 is always the complete state** and is checked in tests by decoding real GIFs.
- **GIF budgets:** at most 300 KB, at most 12 fps. If an animation is too big the renderer reduces colours, frames or resolution automatically and tells you what it reduced.
- **1-bit transparency:** GIF has only on/off transparency, so glows and fades over transparent areas are rendered as solid colours or shrinking shapes.
- **Mobile-safe width:** the main block is at most 400 px (600 px if you choose Wide); banners are 460 px and scale down on phones. Social icon rows keep 32 px tap targets, body text is at least 12 px.
- **Contrast:** text colours are auto-adjusted to 4.5:1 on the signature background. Accent colours are nudged into the range that reads on both light and dark backgrounds.
- **Dark mode:** mail clients invert colours themselves. Use a transparent background (the default) and avoid pure-white GIF backgrounds.
- **Privacy:** no tracking pixels, no open tracking.

## Signature marks

- **Typed:** your name in one of ten open-licensed handwriting fonts, baked into the image. A pen traces each glyph's outline, then the fill blooms in.
- **Drawn:** sign with a mouse, trackpad, finger or stylus.
- **Scanned:** a photo or scan of your real signature is traced into pen strokes in your browser (dark ink on light or transparent paper).

Loop forever, or play three times and stop on the finished signature.
