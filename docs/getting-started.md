---
title: Getting started
order: 1
---

# Getting started

MailMotion makes animated email signatures that work in Gmail, Outlook and Apple Mail. There are three ways to use it.

## 1. The hosted builder (no install)

Open the [builder](/studio/), pick a design, enter your details and photo, and tweak anything. It all runs in your browser: your photo is never uploaded until _you_ publish the finished images.

To use the signature you need to **host its images** somewhere public (Gmail and Outlook do not show images embedded in an email or signature). Choose one:

|                  | Best for                  | What it is                                                                                 |
| ---------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| **GitHub Pages** | Most people               | Sign in with GitHub and press Publish. Images go to a public repo in _your_ account. Free. |
| **Your storage** | Teams and technical users | Run the storage server with Docker (disk, S3, R2 or MinIO) and upload from the builder.    |
| **ZIP**          | Anything else             | Download a ZIP, upload the images anywhere public, enter the address.                      |

Then follow the [install guide](/docs/install/) for your email app.

## 2. Self-host everything

```bash
git clone https://github.com/satiyaganes06/mailmotion.git
cd mailmotion
cp .env.example .env      # set MM_UPLOAD_TOKEN (openssl rand -hex 32)
docker compose up
```

See [Self-hosting](/docs/self-hosting/).

## 3. Command line and CI

```bash
npx mailmotion init --preset wave --name "Ada Lovelace"
npx mailmotion render signature.json --base-url https://img.example.com --check
```

See [the CLI](/docs/cli/).

## Limits every signature respects

- HTML: at most **10,000 characters** (Gmail's limit).
- Each GIF: at most **300 KB**, at most **12 fps**, and **frame 1 is always the complete design** (classic Outlook 2016/2019 shows only frame 1).
- Text and links are live HTML; only the avatar, signature mark, banner and icons are images.
- Links are `https:`, `mailto:` and `tel:` only. No `<script>`, no `<style>` blocks, no tracking pixels.
