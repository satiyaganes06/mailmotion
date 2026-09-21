---
title: Compatibility
order: 1
---

# Compatibility

A signature has to work in two directions: it must **install** in the client you write from, and **render** in the client your recipient reads on.

> **Status: not yet verified on real devices.** Automated checks (below) run on every change, but nobody has yet sent these signatures through each mail client below and recorded the result. The matrix is the checklist for that work; every cell starts as ⬜ _untested_. Please help fill it in: see "How to test" and open a pull request with screenshots.

## Matrix (per release)

Legend: ⬜ untested · ✅ pass · ⚠️ partial (note) · ❌ fail (note) · — not applicable

### Render (receive side)

| Client         | Web                   | Desktop                                                                                | iOS app                  | Android app |
| -------------- | --------------------- | -------------------------------------------------------------------------------------- | ------------------------ | ----------- |
| **Gmail**      | ⬜ Chrome, ⬜ Safari  | —                                                                                      | ⬜                       | ⬜          |
| **Outlook**    | ⬜ Outlook on the web | ⬜ new Outlook, ⬜ classic 2016, ⬜ classic 2019, ⬜ Microsoft 365, ⬜ Outlook for Mac | ⬜                       | ⬜          |
| **Apple Mail** | ⬜ iCloud Mail        | ⬜ Mail for macOS                                                                      | ⬜ Mail for iOS / iPadOS | —           |

Test each in **light and dark mode**, with the Aurora, Wave and Equalizer designs at minimum, and confirm frame 1 is complete in classic Outlook 2016/2019.

### Install (send side)

| Client                    | Method                                                        | Status |
| ------------------------- | ------------------------------------------------------------- | ------ |
| Gmail web                 | Copy formatted signature                                      | ⬜     |
| Gmail iOS / Android       | Turn mobile signature off, use web signature                  | ⬜     |
| Outlook web / new Outlook | Copy formatted signature                                      | ⬜     |
| Classic Outlook (Windows) | `.htm` into `%APPDATA%\Microsoft\Signatures`, or paste        | ⬜     |
| Outlook for Mac           | Copy formatted signature                                      | ⬜     |
| Outlook iOS / Android     | Send-to-phone page, paste                                     | ⬜     |
| Apple Mail macOS          | `.mailsignature` file (replace placeholder, lock), or paste   | ⬜     |
| Apple Mail iOS / iPadOS   | Send-to-phone page, paste, "Undo Change Attributes" if needed | ⬜     |
| iCloud Mail web           | Paste (limited formatting)                                    | ⬜     |

## What behaves how (from the plan and client documentation)

| Client                          | Animated GIF                                        | CSS in `<style>` | SVG      | Key constraint                                                       |
| ------------------------------- | --------------------------------------------------- | ---------------- | -------- | -------------------------------------------------------------------- |
| Gmail web, iOS, Android         | ✅                                                  | stripped         | stripped | 10,000-character signature limit; images are proxied and cached      |
| Outlook web / new Outlook       | ✅                                                  | partial          | ❌       | Paste-based signature editor                                         |
| Classic Outlook (Windows)       | Microsoft 365 builds ✅; 2016/2019 **frame 1 only** | Word engine      | ❌       | Tables and inline styles only                                        |
| Outlook for Mac / iOS / Android | ✅                                                  | partial          | ❌       | Mobile apps apply their own dark mode                                |
| Apple Mail (macOS, iOS)         | ✅                                                  | ✅               | ✅       | Mail Privacy Protection preloads images (fine: we never track opens) |
| iCloud Mail web                 | ✅                                                  | partial          | ❌       | Send-side editor is limited                                          |

This is why signatures are tables with inline styles, images are hosted GIF/PNG, and frame 1 is always complete.

## What is verified automatically today

These run in CI on every change:

- **HTML:** every design and layout renders lint-clean (no `<script>`, `<style>`, event handlers, non-https URLs, tracking pixels), stays within 10,000 characters, uses ≥ 12px text and ≥ 32px social tap targets; property-based tests generate random customizations and check the same rules.
- **Injection:** hostile input in every text field across all six layouts stays inert.
- **GIFs:** decoded from the real output and checked for ≤ 300 KB, ≤ 12 fps, loop count, and that **frame 1 is the complete state** (ring closed, photo revealed, mark inked, banner drawn).
- **Contrast:** text colours meet 4.5:1 on the signature background for random palettes; accents sit in the light/dark-readable range.
- **Uploads:** GIF/PNG sanitizer, size/pixel caps, metadata stripping.
- **Publishing:** the GitHub flow (PKCE, single commit, Pages wait) end to end against a local mock.

What automation **cannot** tell you: how a specific mail client and version actually draws the result. That needs the manual matrix above.

## How to test

1. Build a signature in the builder (or `npx mailmotion render`), host the images, and install it in the client under test.
2. Use **Download test email (.eml)** or send yourself a real message.
3. Read it on the receiving client(s) in light and dark mode, on desktop and phone.
4. Record ✅/⚠️/❌ per cell, with client version, and add screenshots to `docs/compat/<release>/<client>-<light|dark>.png`.
5. Note anything that looks wrong (blurry GIF, wrong colours, layout shift, missing images) in the pull request.

Devices: at least one iPhone, one Android phone, one Mac and one Windows PC. Older or borrowed devices are fine; BrowserStack or Email on Acid / Litmus help at scale.
