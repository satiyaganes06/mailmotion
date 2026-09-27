---
title: Simple Style
order: 6.5
---

# Simple Style

"Build my signature" first asks **Simple Style** or **Custom Style**. The choice is remembered in
your browser; "← Change style" in either builder always asks again.

- **Custom Style** is the six-design builder with every option. See [Designs and limits](./designs.md).
- **Simple Style** (`/studio/simple/`) has the ten **Signet** designs: the same designs in the same
  order, the same live previews and the same copied HTML as the Signet reference page. The builder
  around them uses MailMotion's design system, like the rest of the site.

Simple Style lives in `packages/signet` (templates, GIF renderer, encoder) and
`apps/web/src/signet` (the page). Besides image hosting, it shares only the site-wide design system
(CSS tokens and classes, and the theme toggle) with Custom Style; it does not use Custom Style's
schema, layouts, serializer, presets or builder components.

## What "exactly" means here

- **The signature HTML is the reference, byte for byte.** `packages/signet/test/fixtures` holds
  the Signet page as published. The tests run that page's own template code and compare it with
  ours for the sample details, edge cases (empty fields, long names, characters that need
  escaping) and 150 random inputs.
- **Every signature preview is laid out like the reference.** The email mock-up and each
  signature keep the reference's own styles, so they render the same inside MailMotion's page.
- **The live previews are the reference's CSS**, transcribed rule for rule. Only the builder
  chrome (header, form, buttons, cards) is MailMotion's: studio bar, panels, fields, buttons and
  chips from `globals.css` / `studio.css`, in light and dark.

## The one functional change: no manual GIF hosting

The reference page asked for a "GIF host URL" and left rendering and uploading the GIFs to you.
Here, **copying a design is what hosts it**: "Copy signature" or "Copy HTML source" renders that
one design's animated image and uploads it to this site's image storage (the same storage server
Custom Style uses, `NEXT_PUBLIC_UPLOAD_ENDPOINT` / `NEXT_PUBLIC_UPLOAD_TOKEN`). The copied
signature then points to that image. It takes a second or two; the button shows "Preparing
image…" meanwhile.

- **Nothing is uploaded while you browse or edit**, so the bucket only ever holds designs you
  actually copied. Uploaded images are never deleted, because emails you already sent keep
  pointing at them.
- **Uploads are re-used.** Each is keyed by only what that design draws. Copying it again,
  or after changing something it doesn't show (for example the job title), re-uses the image;
  changing something it does show (for example the name, on the three designs that draw it)
  uploads a new one on the next copy.
- **Rendering runs in a background worker** (with a main-thread fallback), and hovering a card
  starts rendering its image early so the copy mostly waits on the upload.
- **The clipboard write starts inside the click** and receives the signature once the upload is
  done, which is what browsers require. If a browser can't do that, the card says "Image ready —
  click Copy again", and the second click copies instantly.
- **"Upload all … now"** in the Animated images panel is still there for anyone who wants every
  design hosted up front.

## How the GIFs are made

Each design's animated slot is drawn frame by frame on a canvas, following its CSS rules exactly:
sizes, offsets, keyframes, easing curves, shadows and blur radii. The GIFs follow the same limits
as Custom Style: at most 300KB, at most 12 fps, and they loop forever. Nine of the ten designs
render at 2x for sharp retina display. The News ticker's scrolling text changes almost every
pixel on every frame, so it is encoded at 1x to keep its full 10 fps within 300KB. The tests
decode every frame of every GIF, compositing as a mail client does, and check it against what was
drawn.

The first frame is always the finished state, because classic Outlook only ever shows frame 1:
the typewriter fully typed, the ink signature fully inked, the neon lit.

### Where a GIF cannot match the CSS exactly

- **Loop lengths.** A GIF has a single loop, but some designs combine motions of different
  lengths. Wave (6s and 9s slides) loops at 18s, which is exact. Orbit's two satellites (4s and
  2.6s) loop at 8s, so the inner satellite is 2.5% slower than on the page. The typewriter's cursor
  blinks every 0.71s instead of 0.7s so it lines up with the 5s typing loop.
- **Neon's flicker** eases in and out over 64ms on the page; the GIF shows the dimmed frame for
  the 130ms dip (GIF timing works in 10ms steps, and 12 fps is the ceiling).
- **Equalizer's first frame** shows the bars at their starting heights. With animations turned
  off, the page's "Preview as classic Outlook" shows all five bars at full height, which the
  running animation never does.
- **Fonts.** GIFs are rendered with your browser's Arial and Courier New, like the live preview;
  the ink design uses the self-hosted Caveat (weight 600, as on the reference).
