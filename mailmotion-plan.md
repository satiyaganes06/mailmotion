# MailMotion — Open-Source SaaS for Animated Email Signatures

**Build plan · v1.0 Community (self-hosted, free, no subscription) → cloud SaaS later · Gmail, Outlook and Apple Mail on web, desktop and mobile**

Design references (6 prebuilt designs):

- *Signet Signature Set* (https://claude.ai/artifact/MEqE2oLayugotvqNvd8pj3): Card + Aurora ring, Left Portrait + Strip-reveal, Editorial + Ink signature
- *Signet Vivid Set* (https://claude.ai/artifact/2Z81nrmoBBKioezXeteB7E): Banner + Wave, Bordered + Neon night, Stacked + Equalizer

Each design pairs an **animated avatar** with an **animated ink signature mark**, a social icon row and a website link. All of them use table-based HTML with hosted GIFs, and each keeps a complete first frame, ≤ 10,000 characters of HTML, ≤ 300 KB per GIF and ≤ 12 fps.

---

## 1. Vision

> Animated, brand-quality email signatures that actually render in Gmail and Outlook, open source, private by default, and free to self-host.

**Who it's for**

| Segment | Need | Plan |
|---|---|---|
| Individuals (freelancers, creators, job seekers) | A standout signature in 3 minutes | Free |
| Professionals and personal brands | Custom avatar and signature mark, own domain, no badge | Pro |
| Teams and SMEs | One brand, many staff, central updates, deployment | Team |
| Developers and privacy-conscious orgs | Run it themselves | Self-host (free) |

**What sets it apart**

1. **It renders for real.** Every template is tested against Gmail and classic, new and web Outlook, and frame 1 is always complete.
2. **Privacy by default.** No tracking pixels and no read receipts. Click analytics are opt-in and aggregate only.
3. **Open source.** The core is self-hostable and the templates are community-built.
4. **Security built in.** The image proxy is hardened against SSRF, uploads are re-encoded, and the output is XSS-safe.

> ⚠️ Before launch, check that **MailMotion** is free to use as a trademark, domain and GitHub org.

---

## 2. Release strategy: self-hosted first

### 2.1 Decision

**v1.0 "MailMotion Community" is fully free, open source and self-hosted, with no subscription, accounts or billing.** The paid cloud version is built only after v1 shows real usage.

**Why**
- It removes about half the original roadmap: billing, accounts, multi-tenancy, teams, deployment, analytics and moderation.
- No server running costs, and no responsibility for storing users' personal data.
- There is no image proxy in v1, so no SSRF attack surface (§6).
- Real usage data, rather than guesses, decides whether the cloud version is worth building.

### 2.2 How v1 is shipped

| Channel | Who it's for | What it is |
|---|---|---|
| **Hosted builder** at `mailmotion.app` | Everyone | A static site that runs entirely in the browser: editing, serializer, GIF rendering and export. No login and no backend, apart from one small serverless function for GitHub sign-in (§4.5) |
| **Docker Compose** | Technical users and organizations | The same builder plus a small storage-upload server for S3, R2, MinIO or local disk |
| **CLI** (`npx mailmotion`) | Developers and CI | Render and export signatures from JSON configs |

### 2.3 Two hosting paths

Gmail won't show embedded `data:` images, so every signature needs its GIFs and icons at a public URL. v1 offers **two paths**, depending on the user:

| | **Path A: technical users** | **Path B: non-technical users** |
|---|---|---|
| Method | Built-in storage adapters, set up with Docker | **One-click publishing to GitHub Pages** |
| Storage | S3, Cloudflare R2, MinIO or local disk (behind the user's own domain or CDN) | A public repo in the user's own GitHub account, served by GitHub Pages |
| Setup | `docker compose up` + adapter settings in `.env` | Sign in with GitHub → click "Publish" |
| Image URL | `https://img.yourdomain.com/<hash>.gif` | `https://<username>.github.io/mailmotion-signatures/<hash>.gif` |
| Cost | The user's own storage costs (usually a few cents or free) | Free |
| Custom domain | Yes | Optional (GitHub Pages supports custom domains) |

**Fallback for both paths: "Download ZIP".** The user hosts the GIFs and icons anywhere, enters the base URL, and MailMotion regenerates the signature HTML with that URL. Details of all three are in §4.5.

### 2.4 Decisions to lock in now, even without a subscription

- **The MIT (packages) / AGPL-3.0 (apps) licence split, plus a CLA or DCO.** Changing a licence after people have contributed requires their consent.
- **The storage adapter interface.** A future cloud CDN becomes just another adapter.
- **Portable JSON signature configs.** Signatures made in v1 move to the cloud version later without being rebuilt.
- **Privacy-friendly site analytics** (Plausible or Umami: cookieless, no personal data). Usage numbers decide the cloud go/no-go.

### 2.5 Later: open-core cloud (post-v1, only if validated)

**Go signal (within 3–6 months of launch):** ≥ 1,000 GitHub stars, ≥ 5,000 signatures exported, and repeated requests for hosting or team features.

| | Community (v1, free) | Cloud Free | Cloud Pro | Cloud Team |
|---|---|---|---|---|
| All designs + full customization | ✅ | ✅ | ✅ | ✅ |
| Hosting | Path A / Path B / ZIP | MailMotion CDN | CDN + custom domain | CDN + custom domain |
| Signatures | Unlimited | 1 | 5 | Per seat |
| Brand kit, bulk generation, Google Workspace and Microsoft 365 deployment | Self-built | — | — | ✅ |
| Campaign banners, opt-in click analytics | — | — | ✅ | ✅ |
| Support | Community | Community | Email | Priority + SSO |

**Suggested pricing (validate first):** Pro about USD 4/month; Team about USD 3 per seat per month.

**Licensing**

| Part | Licence |
|---|---|
| `packages/*` (serializer, renderer, presets, contrast, icons, ink) | **MIT** |
| `apps/*` (builder, publish function, storage server, CLI) | **AGPL-3.0** |
| Future cloud-only code (billing, SSO) | Private `ee/` folder |

## 3. Platform support and rendering rules

### 3.1 Target matrix

v1 covers **three email families across every platform they run on**. A signature has to work in two directions:

- **Sending:** it installs correctly in the client the user writes from.
- **Receiving:** it renders correctly in whatever client the recipient reads on.

| Family | Web | Desktop | iOS app | Android app |
|---|---|---|---|---|
| **Gmail** | mail.google.com | (web) | Gmail for iOS | Gmail for Android |
| **Outlook** | outlook.com / Outlook on the web | New Outlook (Win), classic Outlook (Win), Outlook for Mac | Outlook for iOS | Outlook for Android |
| **Apple Mail** | iCloud Mail (icloud.com) | Mail for macOS | Mail for iOS / iPadOS | — (receive side only) |

### 3.2 Rendering behaviour (receive side)

| Client | Animated GIF | CSS / `<style>` | SVG | Key constraint |
|---|---|---|---|---|
| Gmail web, iOS, Android | ✅ | Stripped | Stripped | 10,000-char signature limit; images proxied and cached |
| Outlook web / new Outlook | ✅ | Partial | ❌ | Paste-based signature editor |
| Classic Outlook for Windows | Microsoft 365 builds ✅; 2016/2019 **frame 1 only** | Word engine | ❌ | Tables and inline styles only |
| Outlook for Mac / iOS / Android | ✅ | Partial | ❌ | Mobile apps apply their own dark mode |
| Apple Mail macOS / iOS | ✅ | ✅ (including `@keyframes`) | ✅ | Mail Privacy Protection preloads images, which is fine because we don't track opens |
| iCloud Mail web | ✅ | Partial | ❌ | Receive side is fine; the send-side signature editor is limited (§4.2) |

### 3.3 Rules that follow from this

- **Baseline for every client:** text, links and the social row are live HTML (tables with inline styles). The avatar and ink signature are **hosted GIFs**, rendered at 2× and displayed at 1×.
- **Frame 1 must be complete**, because classic Outlook 2016/2019 shows only that frame.
- **Progressive enhancement for Apple Mail (Phase 7, optional):** Apple Mail supports CSS animation, so a later version could ship sharper CSS animation for Apple Mail recipients, with the GIF as the fallback. It only helps when the signature is installed through the `.mailsignature` file route (§4.2). The GIF baseline already works in Apple Mail, so this is polish, not a requirement.
- **Mobile-safe width.** Recipients read on phones around 360–400 px wide, so:
  - Keep the main block **≤ 400 px wide**. Only full-width strips (Wave banner, Ticker) go wider, up to 460 px.
  - Strips use `width="460"` (classic Outlook reads the attribute) together with `style="width:100%;max-width:460px;height:auto"`, so they shrink to fit phone screens.
  - Keep tap targets **≥ 32 px high** for the social icons, with about 8 px of spacing, so they're easy to tap.
  - Minimum font size 12 px; iOS Mail may enlarge anything smaller.
- **Dark mode on every platform:** Gmail apps and Outlook apps fully invert colours, while Apple Mail and Outlook for Mac only partly adjust them. Avoid pure-white GIF backgrounds (give them a subtle padded frame instead), and check contrast against both light and dark backgrounds.
- Social icons are hosted 2× PNGs, never SVG.
- Image URLs use hashed filenames, so Gmail's proxy cache picks up changes.

## 4. Feature set

### 4.1 The 6 prebuilt designs

MailMotion launches with **6 designs**. Each one is a preset: a layout, an avatar animation, an ink signature style and a default theme. Every part of a preset can be customized (§4.2).

| # | Design | Layout | Avatar animation | Signature mark | Frame 1 (classic Outlook) | Best for | Source set |
|---|---|---|---|---|---|---|---|
| 1 | **Aurora** | Card | Spinning gradient ring around the photo or initials | Ink draw | Ring complete, name inked | Anyone, professional default | Signature Set |
| 2 | **Portrait** | Left Portrait | Diagonal strip-reveal of the photo | Ink draw | Photo fully revealed | Personal brands, sales, consultants | Signature Set |
| 3 | **Editorial** | Editorial | Pulse ring (availability) | Large ink signature as the headline | Solid avatar, name inked | Writers, lawyers, founders | Signature Set |
| 4 | **Wave** | Banner | Spinning avatar ring + rolling wave banner strip | Ink draw | Ring and banner complete | Brand-led teams | Vivid Set |
| 5 | **Neon** | Bordered | Neon glow pulse on a square avatar | Neon-ink draw | Mark lit | Creative studios, after-dark brands | Vivid Set |
| 6 | **Equalizer** | Stacked | Bouncing audio bars beside the avatar | Ink draw | Bars at rest, name inked | Podcasters, musicians, mobile-first | Vivid Set |

Internally, the designs are built from a **layout × animation × signature style** system. That lets users remix them (e.g. the Neon avatar on the Card layout), and makes new designs cheap to add after launch. Community designs arrive through the template marketplace (Phase 7).

### 4.2 Customization: maximum control, email-safe output

Every option below is available on all 6 designs. The **guardrails** column shows how the builder keeps the output working in Gmail, Outlook and Apple Mail, whatever the user chooses.

#### A. Personal details

| Option | Details | Guardrail |
|---|---|---|
| Full name | Required | Escaped; max 60 characters |
| Pronouns | Optional, e.g. "(she/her)", shown after the name | Max 20 characters |
| Designation / job title | Optional | Max 80 characters |
| Department | Optional | Max 60 characters |
| Company | Optional, can be linked to the company website | Max 80 characters |
| Phone numbers | Up to 3 (mobile, office, WhatsApp), each with a label | `tel:` links, normalized to E.164 |
| Email | Optional (it's already in the From line, but some users want it shown) | `mailto:` links |
| Websites | Personal and company, up to 2 | `https:` only |
| Address | Optional, 1–2 lines, can link to Google Maps / Apple Maps | Max 120 characters |
| Tagline / quote | Optional line in italics | Max 90 characters |
| Custom fields | Up to 3 label + value pairs (e.g. "License No.", "Calendly") | Escaped, optional link |
| Field order | Drag to reorder the contact lines | — |
| Field visibility | Show or hide each field individually | — |

#### B. Avatar

| Option | Details | Guardrail |
|---|---|---|
| Source | Upload a photo, use a photo URL (through the SSRF-hardened proxy), show initials, or upload a company logo | Re-encoded; EXIF stripped |
| Crop and zoom | Drag to position, zoom slider, rotate | Output cropped to the slot size at 2× |
| Shape | Circle, rounded square, square, squircle | Baked into the GIF, since Outlook ignores `border-radius` |
| Size | S / M / L (e.g. 64 / 80 / 96 px) | Keeps the layout within 400 px |
| Animation | Any of: Aurora ring, Strip-reveal, Pulse, Neon glow, Orbit, Equalizer, or **None (static)** | Frame 1 is always complete |
| Animation speed | Slow / Normal / Fast | ≤ 12 fps; flashing stays below 3 per second |
| Ring / border colour | Follows the accent colour, or a custom colour or gradient | — |
| Filters | None, greyscale, duotone (in accent colours) | — |
| Background removal | Optional, for photos (runs in the browser) | Pro |

#### C. Signature mark

| Option | Details | Guardrail |
|---|---|---|
| Mode | **Typed** (name set in a script font), **Drawn** (mouse, trackpad, finger or stylus) or **Uploaded** (image of a real signature, background removed) | Drawn and uploaded marks are vectorized into strokes for the ink animation |
| Text | Full name, first name, initials or custom | Max 30 characters |
| Handwriting style | 8–10 script fonts (open-licensed, e.g. Caveat, Dancing Script, Great Vibes, Allura, Sacramento, Homemade Apple) | Fonts baked into the GIF, so no font loading in email |
| Ink colour | Accent colour, black, navy, custom colour or gradient | Dark-mode contrast check |
| Stroke width | Thin / Medium / Bold | — |
| Animation | Ink draw, fade in, or **None (static)** | Frame 1 shows the name fully inked |
| Draw speed and hold time | How fast it writes, and how long it stays before looping | — |
| Loop | Loop forever, or play 3 times and stop | Stops on the complete frame |
| Size and position | S / M / L; above the name, beside the name, or replacing the name | Layout-aware |
| Show or hide | Toggle the signature mark off completely | — |

#### D. Colours and theme

| Option | Details | Guardrail |
|---|---|---|
| Accent colour | Colour picker, hex input, or colour extracted from the logo | **Contrast engine:** auto-darkened link colour ≥ 4.5:1 against light and dark backgrounds, with a live warning |
| Secondary colour | For gradients, rings and banners | — |
| Text colours | Name, title and body text colours, set separately | Contrast checked |
| Background | Transparent (the default, safest option), white or a colour card | Coloured cards are checked in dark mode |
| Palette presets | 12+ curated palettes (e.g. Ocean, Sunset, Forest, Mono, Neon) | — |
| Brand kit | Save colours, logo and font for reuse (Pro); locked for teams (Team) | — |
| Dark-mode behaviour | Auto, or force a darker variant for dark themes | Preview in both modes |

#### E. Typography

| Option | Details | Guardrail |
|---|---|---|
| Font family | Email-safe stacks only: Arial/Helvetica, Georgia, Verdana, Tahoma, Trebuchet MS, Times New Roman | Custom web fonts don't load in Gmail or Outlook, so the name can be baked into the GIF as a "display name" option instead |
| Name size | 14–24 px | — |
| Body size | 12–15 px | Minimum 12 px, since iOS enlarges anything smaller |
| Weight and case | Bold/regular; normal / UPPERCASE / Small caps for the name and title | — |
| Letter spacing | Tight / Normal / Wide | — |
| Line height | Compact / Normal / Relaxed | — |

#### F. Social media links

| Option | Details | Guardrail |
|---|---|---|
| Add / remove / reorder | Drag and drop, with no fixed limit (recommend ≤ 7) | Warning above 7 because of width and character budget |
| Platforms | LinkedIn, GitHub, X, Instagram, Facebook, YouTube, TikTok, Threads, Bluesky, Mastodon, Behance, Dribbble, Medium, Substack, WhatsApp, Telegram, Discord, Calendly, Spotify, Apple Podcasts, plus a **custom link** with an uploaded icon | Profile URLs validated per platform; `https:` only |
| Icon style | Filled, outline, circle badge, square badge, brand colours or a single colour | Hosted 2× PNGs, generated per style and colour |
| Icon size | 16 / 20 / 24 / 32 px | Tap target ≥ 32 px on mobile |
| Spacing | Tight / Normal / Wide | — |
| Position | Below the details, beside the name, or in a separate row | — |
| Text links instead | Option to show "LinkedIn · GitHub" as text rather than icons | Works even when images are blocked |

#### G. Banners and extras

| Option | Details | Guardrail |
|---|---|---|
| Banner strip | Wave, Ticker, Shimmer or a static uploaded image; with text, link and colours | Width ≤ 460 px and scales on phones |
| Campaign scheduling | Swap the banner between dates (Pro/Team) | Hashed URLs |
| Call-to-action button | E.g. "Book a call", as a bulletproof table button with its own colour and link | Built with tables so classic Outlook shows it correctly |
| Company logo | Separate from the avatar, static or animated | — |
| Badges | Certifications or awards (up to 4 small images) | Size-limited |
| Disclaimer / legal text | A small-print block (confidentiality, PDPA or GDPR notice) | Counted against the character budget |
| Green note | e.g. "Please consider the environment before printing" | — |
| Divider | None, line, dotted, or gradient bar (image) | — |
| Spacing and padding | Compact / Normal / Airy | — |
| Alignment | Left or centered (Stacked and Editorial designs) | — |
| "Made with MailMotion" badge | Shown on the Free tier; removable on Pro | — |

#### H. Layout controls

| Option | Details |
|---|---|
| Switch layout | Move the same content to any of the 6 designs, or any layout, without losing edits |
| Remix | Mix parts from different designs (e.g. the Neon avatar with the Editorial layout) |
| Section toggles | Show or hide the avatar, signature mark, social row, banner, CTA or disclaimer |
| Width | Mobile-safe (≤ 400 px, the default) or Wide (≤ 600 px) |
| Signature variants | Save "Full", "Reply" (compact, without the banner) and "Mobile" versions of the same signature |

#### I. Builder experience

- **Live preview** updates as you type; the Animated / Email toggle shows the exact serializer output
- **Client preview switcher:** Gmail, Outlook and Apple Mail × desktop and phone × light and dark
- **Classic Outlook preview** showing frame 1 only
- **Live budget meters:** HTML characters (limit 10,000), total GIF size (limit 300 KB each) and the contrast status
- Undo / redo, autosave, version history
- **"Randomize" and "Surprise me"** for palettes and pairings
- Duplicate a signature, save presets, import/export as JSON (portable between cloud and self-hosted)
- Keyboard shortcuts and accessible controls (WCAG 2.2 AA builder UI)
- A short onboarding: pick a design → enter name and photo → done in 60 seconds, with everything else available in "Customize"

#### Budget protection

With this much freedom, a signature can outgrow the limits. The builder handles that:

1. **Characters over 10,000:** warn at 8,500, then suggest fixes such as fewer social icons, shorter disclaimer or text links, and block the Gmail export until the signature fits.
2. **GIF over 300 KB:** render automatically at a lower frame count or size, and show the size saving.
3. **Contrast fails:** auto-adjust the colour, with a one-click "Use the suggested colour".
4. **Width over the limit:** switch to the stacked variant on narrow screens, or warn.

### 4.3 Export and install (every platform)

**Export formats**
- One-click **copy of the formatted signature**: `text/html` on the clipboard, for paste-based editors
- Copy the HTML source
- Download a `.htm` file (classic Outlook)
- Download a `.mailsignature` file together with a guided installer (Apple Mail on macOS)
- A **"Send to my phone" page** (see below)
- A **"Send me a test email"** button, so users can check how the signature arrives on their own devices

**Install paths**

| Client | Install method | Automation |
|---|---|---|
| Gmail web | Settings → See all settings → General → Signature → paste | Copy button |
| Gmail iOS / Android | The mobile signature setting is plain text only. **Turn the mobile signature off** and the app uses the web signature for Google accounts | Guide |
| Outlook on the web / new Outlook | Settings → Accounts → Signatures → paste | Copy button |
| Classic Outlook (Windows) | File → Options → Mail → Signatures → paste, **or** drop the `.htm` into `%APPDATA%\Microsoft\Signatures` | Copy / `.htm` |
| Outlook for Mac | Settings → Signatures → + → paste | Copy button |
| Outlook iOS / Android | Settings → Signature. Formatting support is limited and varies by version; recent Microsoft 365 builds can sync signatures from the web | Guide (verify in Phase 1) |
| Apple Mail macOS | Settings → Signatures → create a placeholder → quit Mail → replace the `.mailsignature` file with the MailMotion one → lock the file. Pasting also works for simple designs | `.mailsignature` + guide |
| Apple Mail iOS / iPadOS | Open the signature on the phone in Safari → copy → Settings → Apps → Mail → Signature → paste → if the formatting is lost, **shake to undo** ("Undo Change Attributes") | "Send to my phone" page |
| iCloud Mail web | The signature editor has limited formatting | Guide; recommend sending from Apple Mail apps |

> The install steps above reflect client behaviour as of the plan date. Mail apps change often, so Phase 1 must verify each path on a real device, and the guides need updating every release.

**"Send to my phone" page**

Mobile users usually can't paste HTML, and they don't have a desktop at hand when they set up their phone. For them:

1. From the desktop builder, the user scans a **QR code** or receives a private link (`m.mailmotion.app/s/<token>`).
2. The phone opens a mobile-optimized page that shows the **rendered signature** plus step-by-step instructions for the detected platform (iOS Mail, Gmail app, Outlook app).
3. A single **"Copy signature"** button copies it for pasting into the phone's mail app.
4. The token expires after 24 hours and can't be guessed; the page is `noindex`.

### 4.4 MailMotion on mobile (the product itself)

- The builder (`/studio`) and dashboard are **fully responsive**. They're designed mobile-first, with a single-column editor and a preview drawer on phones.
- Offered as a **PWA**: installable, and it keeps drafts offline.
- **No native app for v1.** Neither iOS nor Android lets apps set another app's mail signature, so a native app would add little over the PWA and the "Send to my phone" page. If demand appears later, build a Flutter app (Phase 8).
- The mobile preview shows each signature in a **phone-width frame**, in light and dark mode, for Gmail, Outlook and Apple Mail.

### 4.5 Hosting (v1: two paths)

#### Path A: storage adapters (technical users)

- Ships with the Docker Compose setup: the builder plus a small **storage server** (`apps/storage-server`).
- Adapters: **S3**, **Cloudflare R2**, **MinIO** and **local disk** (served by the bundled Caddy container).
- Configuration lives in `.env`:

```env
MM_STORAGE=r2            # s3 | r2 | minio | disk
MM_PUBLIC_BASE_URL=https://img.example.com
MM_S3_ENDPOINT=...
MM_S3_BUCKET=mailmotion
MM_S3_ACCESS_KEY_ID=...
MM_S3_SECRET_ACCESS_KEY=...
MM_UPLOAD_TOKEN=...      # shared secret required by the builder to upload
```

- Uploads require the upload token, so only the owner can publish.
- Files are stored under content-hashed names (`<sha256>.gif`), with `Cache-Control: public, max-age=31536000, immutable`.
- The server validates uploads: file type allowlist, byte and pixel caps, magic-byte checks, and re-encoding.
- A health check tests that the public URL actually serves each image with the right `Content-Type`.

#### Path B: one-click GitHub Pages (non-technical users)

**User flow**

1. The user clicks **"Publish free with GitHub"**.
2. They sign in with GitHub and approve the MailMotion GitHub App for **one repository only**.
3. MailMotion creates `mailmotion-signatures` in their account (or reuses it), commits the GIFs and icons, and turns on GitHub Pages.
4. The builder waits for Pages to go live (usually about 1 minute) and checks that each image URL loads.
5. The signature HTML is regenerated with the Pages URLs, ready to copy or install.
6. Later edits publish new hashed files to the same repo. Old files stay, so previously sent emails keep working.

**How it works**

- **A GitHub App** rather than an OAuth App, so permissions are fine-grained and limited to the one repo:
  - `Contents: write` to commit files
  - `Pages: write` to enable Pages
  - `Administration: write` only for creating the repo the first time (or the user creates it via a guided link)
- **The token exchange** needs a client secret, so it runs in one small serverless function (Cloudflare Worker, `apps/publish-fn`). This is the only server-side code behind the hosted builder.
- The **user access token stays in browser memory only**. It's never stored on a server or in `localStorage`, and it's discarded when the tab closes; tokens also expire after 8 hours.
- Files go up in **a single commit per publish** via the GitHub Git Data API. Pages is enabled with `POST /repos/{owner}/{repo}/pages`.
- Status is checked by polling the Pages build API, then fetching each actual image URL.

**Tell users clearly**
- On free GitHub accounts, Pages requires a **public repo**. The photo, signature mark and name become publicly visible there. They're in every email anyway, but say so before publishing.
- GitHub Pages has soft limits (about 100 GB of bandwidth per month and 1 GB per site). That's far above what signatures need, particularly since Gmail's proxy caches images.
- Deleting the repo breaks images in emails that were already sent.

#### Fallback: Download ZIP

- The ZIP contains the GIFs, icons, `signature.html` and a `README` with hosting instructions.
- A **"Set base URL"** field regenerates the HTML once the files are uploaded anywhere (Netlify Drop, Cloudflare Pages, the user's own website).

#### Asset rules (every path)

- Content-hashed filenames, so Gmail's cache picks up edits.
- Never delete old versions automatically.
- HTTPS only, with correct `Content-Type` headers.

### 4.6 Team features (cloud, later)
- Workspace, members, roles (Owner, Admin, Member)
- **Brand kit:** locked layout, colours, logo and banner. Members can edit only their personal fields.
- Directory import from a CSV file, Google Workspace or Microsoft Entra ID
- **Campaign banners:** a scheduled banner swap (e.g. "Visit us at booth 12 · 3–5 Oct") that applies across the whole team
- Bulk re-render when the brand changes
- **Deployment:**
  - **Google Workspace:** the Gmail API `users.settings.sendAs` signature update, using a service account with domain-wide delegation. This is fully automated.
  - **Microsoft 365:** Outlook on the web signatures through Exchange Online PowerShell (`Set-MailboxMessageConfiguration`), run by the admin from a generated script, or an Outlook add-in (later). Microsoft Graph has no general signature API, so be upfront with customers about what can and can't be automated.
- Audit log, and SSO (SAML/OIDC) on Team

### 4.7 Analytics (cloud, later; opt-in only)
- **Click counts only:** links pass through `go.mailmotion.app/<id>` and are counted in aggregate.
- **No open tracking**, no pixels, no per-recipient data. State this publicly on the landing page.
- Off by default, with a visible explanation in the builder.

---

## 5. Architecture

### 5.1 Stack

> **v1 scope:** the hosted builder is a **static site** (Vite + React), plus one Cloudflare Worker for GitHub sign-in. Docker Compose adds the storage server. The database, queue, auth, billing and API rows below belong to the **later cloud version** and aren't built in v1.


| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** end to end | The same serializer and renderer run in the browser, the API and workers, so preview and export can't drift |
| Web app | Next.js (App Router) or Vite + React | Landing page, builder and dashboard |
| API | Node (Fastify or Hono) | Lightweight; shares the packages above |
| Database | PostgreSQL + Drizzle or Prisma | Relational, with tenant isolation |
| Queue | Redis + BullMQ | GIF rendering, bulk jobs, deployment jobs |
| GIF rendering | `@napi-rs/canvas` + `gifenc` (server), canvas + `gifenc` in a Web Worker (browser) | Deterministic frames with shared draw code |
| Storage / CDN | Cloudflare R2 + CDN (S3-compatible) | No egress fees; CNAME support for custom domains |
| Auth | Better Auth / Auth.js (email magic link, Google, Microsoft), SAML via BoxyHQ | Open source |
| Billing | Stripe (Malaysia is supported) or Lemon Squeezy (merchant of record, handles VAT) | |
| Email (test sends) | Resend / SES | |
| Deploy | Docker Compose (self-host), Fly.io or Railway (cloud) | Self-hosters get one command |

> Alternative: Laravel + Inertia for the app and API, with the TypeScript packages running in Node workers for rendering. This plays to Laravel strengths, but the serializer would then have to exist in two runtimes. The single-language TypeScript stack is recommended for v1.

### 5.2 Repository

```
mailmotion/
├── packages/                # MIT
│   ├── schema/              # layout + animation specs, validation (zod)
│   ├── serializer/          # email-safe HTML, single source of truth
│   ├── renderer/            # frame drawing + gifenc, browser + node
│   ├── contrast/            # accent → fill/link, WCAG light + dark
│   ├── presets/             # the 6 prebuilt designs (preset JSON)
│   ├── layouts/             # Card, Left Portrait, Editorial, Banner, Bordered, Stacked, …
│   ├── animations/          # avatar + ink + banner animations
│   ├── icons/               # 20+ social icons × styles × colours → 2× PNG pipeline
│   ├── ink/                 # script fonts, stroke vectorization, ink-draw frames
│   └── storage/             # R2 / S3 / disk / GitHub Pages adapters
├── apps/                    # AGPL-3.0
│   ├── web/                 # landing, /studio builder, dashboard
│   ├── api/                 # REST API
│   ├── worker/              # render, bulk, deploy jobs
│   ├── publish-fn/          # v1: GitHub App token exchange (Cloudflare Worker)
│   ├── storage-server/      # v1: Docker upload server for S3 / R2 / MinIO / disk
│   ├── proxy/               # later: SSRF-hardened image proxy (photo URLs)
│   └── cli/                 # npx mailmotion render ...
├── ee/                      # cloud-only (billing, SSO), separately licensed
├── docker/                  # compose files for self-hosting
└── docs/                    # docs site + compat screenshots
```

### 5.3 Request flow (cloud version; v1 renders and publishes in the browser)

```
Builder (browser)
  ├─ live preview  → serializer (in browser) → HTML + CSS-animated slot
  └─ "Publish"     → API POST /signatures/:id/publish
                        → queue render job
                            → worker: draw frames @2× → gifenc → optimize
                            → upload to R2 as <sha256>.gif
                            → serializer(final URLs) → store HTML version
                     → builder receives HTML → copy / install / deploy
```

### 5.4 Data model (cloud version)

```
User(id, email, name, created_at)
Workspace(id, name, plan, brand_kit_json, custom_image_domain)
Membership(user_id, workspace_id, role)
Signature(id, workspace_id, owner_id, preset_id, layout_id, status)
SignatureConfig(signature_id, version, details_json, avatar_json, mark_json,
                theme_json, typography_json, socials_json, extras_json, layout_json)
                -- validated by @signet/schema (zod); JSON-exportable
SignatureVersion(id, signature_id, html, char_count, assets[], created_at)
Asset(id, workspace_id, kind[avatar|ink|banner|icon|photo], sha256, url, bytes, width, height)
Campaign(id, workspace_id, banner_asset_id, starts_at, ends_at)
Deployment(id, workspace_id, provider[google|microsoft], status, last_run_at, log)
LinkRedirect(id, signature_id, target_url, clicks)   -- only when analytics are on
AuditLog(id, workspace_id, actor_id, action, meta, at)
```

Every table is tenant-scoped by `workspace_id`, with Postgres row-level security as a second line of defence.

### 5.5 Public API (cloud version)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/presets` | List the 6 designs and their default configs |
| `GET` | `/options` | Available layouts, animations, fonts, icons and palettes |
| `POST` | `/signatures` | Create a signature |
| `PATCH` | `/signatures/:id` | Update fields or theme |
| `POST` | `/signatures/:id/publish` | Render GIFs and return the final HTML |
| `GET` | `/signatures/:id/html` | Latest HTML |
| `POST` | `/assets` | Upload a photo or logo (re-encoded) |
| `POST` | `/workspaces/:id/bulk` | Generate from CSV or directory |
| `POST` | `/workspaces/:id/deploy` | Push to Google Workspace |

API keys are scoped per workspace, with rate limits.

---

## 6. Security and privacy

MailMotion takes images and HTML from users and serves them into other people's inboxes, so security is part of the product.

**Output safety**
- HTML-escape every field.
- Allow only the `https:`, `mailto:` and `tel:` URL schemes.
- A serializer lint blocks `<script>`, event handlers, `style` blocks and `javascript:` URLs.
- Run injection tests in CI across every layout.

**v1 note:** v1 accepts **photo uploads only**, processed in the browser, so there's no image proxy and no SSRF attack surface. Photo URL import arrives with the cloud version, together with the hardened proxy described below.

**GitHub publishing (v1)**
- A GitHub App with the smallest possible scope, limited to one repo.
- The user token lives in browser memory only; it's never logged or stored on a server.
- `state` and PKCE checks on sign-in, with a strict redirect URI.
- The Worker validates the request origin, is rate-limited, and logs no tokens.
- A strict CSP on the builder (scripts only from our own origin) to protect the in-memory token from injected scripts.

**Storage server (Docker, v1)**
- An upload token is required.
- File type allowlist, magic-byte checks, byte and pixel caps, and re-encoding.
- Serve with `nosniff` and an explicit `Content-Type`; no directory listing.

**Image proxy (SSRF, cloud version)**
- **DNS pinning:** resolve once, validate, then connect to that pinned IP.
- Block private, loopback, link-local, CGNAT, ULA and IPv4-mapped IPv6 ranges, plus cloud metadata endpoints.
- Normalize decimal, octal and hex IP encodings before checking.
- Allow only the `http`/`https` schemes on ports 80 and 443.
- Re-validate every redirect, and allow at most 3.
- Accept only image content types, and verify magic bytes.
- Cap bytes and pixel dimensions, and set timeouts.
- **Re-encode all images server-side**, which also strips EXIF data, including GPS location.
- Rate-limit requests, and send no cookies or auth headers upstream.

**Uploads**
- Allowlist file types and re-encode everything.
- Serve assets from a separate cookieless domain (`img.mailmotion.app`).
- Set `Content-Type` explicitly, with `X-Content-Type-Options: nosniff`.

**Platform**
- Tenant isolation with row-level security.
- Deployment credentials (Google service account keys) are encrypted at rest with KMS and envelope encryption.
- Scope requests to the smallest possible OAuth scope: `gmail.settings.basic`.
- Audit logs for admin actions.
- Encrypted backups.
- A published security policy (`SECURITY.md`), responsible disclosure, and dependency scanning with Dependabot or Renovate.

**Privacy compliance**
- Malaysia's PDPA (including the 2024 amendments) and the EU GDPR.
- A data processing agreement (DPA) for Team customers.
- Data export and deletion.
- Hosting region choice (Singapore or EU) later.

**Abuse prevention**
- Moderate uploaded images (automated NSFW check).
- Rate-limit account creation.
- Block known phishing brand impersonation in templates.

---

## 7. Quality and testing

**Automated (CI)**
- Serializer snapshot tests for all 6 presets, plus **property-based tests** that generate random customizations and check every output stays within the limits (characters, width, contrast, frame 1)
- A lint for forbidden markup
- GIF checks: bytes ≤ 300 KB, fps ≤ 12, frame 1 complete
- Character count ≤ 10,000
- Contrast checks, light and dark
- Proxy attack tests: rebinding, encoded IPs, redirects to private addresses, oversized or non-image responses
- Tenant isolation tests
- End-to-end Playwright tests of the builder flow

**Manual compatibility matrix (per release)**

Every template is tested for both **install** (send side) and **render** (receive side):

| Family | Web | Desktop | iOS | Android |
|---|---|---|---|---|
| Gmail | Chrome, Safari | — | Gmail app | Gmail app |
| Outlook | Outlook on the web | New Outlook, classic 2016 / 2019 / Microsoft 365, Outlook for Mac | Outlook app | Outlook app |
| Apple Mail | iCloud Mail | Mail for macOS | Mail for iOS, iPadOS | — |

Test devices: at least one iPhone, one Android phone, one Mac and one Windows PC. Borrowed or older devices are fine; cloud device labs (BrowserStack) help for mobile.

**Rendering previews at scale:** Email on Acid or Litmus, from Phase 4 once there's revenue. Until then, send real emails to test accounts on each client.

Test in light and dark mode, and publish the screenshots at `docs/compat/<version>/`. This page doubles as a marketing asset ("see exactly how it renders").

---

## 8. Roadmap

### v1.0 Community (self-hosted, about 10–11 weeks)

| Phase | Weeks | Deliverables | Exit criteria |
|---|---|---|---|
| **0: Foundation** | 1–2 | Monorepo, MIT/AGPL split, CLA, CI, schema, serializer extracted from the Signet builder | Serializer passes snapshot and lint tests |
| **1: Renderer** | 3–4 | In-browser GIF renderer (Web Worker + `gifenc`), frame-1 rule, the 6 designs as presets | Real GIFs play in Gmail, Outlook and Apple Mail on every platform; classic Outlook shows frame 1 complete |
| **2: Builder** | 5–7 | `/studio` with customization groups A–F and I, client preview switcher, budget meters, copy, `.htm` and `.mailsignature` export, "Send to my phone" page, ZIP download | A new user builds a signature in under 3 minutes |
| **3: Hosting paths** | 8–9 | **Path A:** Docker Compose + storage server with S3, R2, MinIO and disk adapters. **Path B:** GitHub App, `publish-fn` Worker, one-click Pages publishing with live URL checks | Both paths publish working image URLs from scratch in under 5 minutes |
| **4: Verify + launch** | 10–11 | Device testing across the full matrix, docs site, install guides, compat page, cookieless site analytics. Launch on GitHub, Product Hunt, Hacker News (Show HN), r/selfhosted, r/opensource and LinkedIn | Installed successfully in all 3 client families on web, desktop and phone |

### v1.x (after launch, community-driven)

- Customization groups G–H: banners, CTA, badges, remix, variants
- Drawn and uploaded signature marks; background removal in the browser
- More designs from the community
- CSS-animation enhancement for Apple Mail
- More storage adapters (Backblaze B2, Azure Blob, Google Cloud Storage), contributed by the community

### Later: cloud SaaS (only if the §2.5 go signal is met)

| Phase | Deliverables |
|---|---|
| **Cloud 1** | Accounts, hosted CDN as an adapter, photo URL import with the hardened proxy, Free tier + badge |
| **Cloud 2: Pro** | Billing (Stripe or Lemon Squeezy), custom image domain, campaign banners, opt-in click analytics |
| **Cloud 3: Team** | Workspaces, brand kit, CSV and directory import, Google Workspace deployment, Microsoft 365 script, audit log, SSO |
| **Optional** | Public API, Outlook add-in, Yahoo support, template marketplace, Flutter companion app |

## 9. Go-to-market

- **Build in public** on LinkedIn: weekly posts on the unusual constraints (why Gmail strips SVG, how Outlook's Word engine works, SSRF hardening). This fits a developer and security audience.
- **The signature is the distribution channel.** The free-tier badge links back to MailMotion, so every email sent is an impression.
- **SEO pages** for "animated email signature Gmail", "GIF signature Outlook", and a "signature not showing in Outlook" fix guide.
- **Community templates:** a gallery with author credit, plus good-first-issue labels for new designers.
- **Launch channels:** Product Hunt, Hacker News (Show HN), r/opensource, r/selfhosted, r/emailmarketing, Indie Hackers.
- **Early Team customers:** SMEs and agencies in Malaysia and Southeast Asia, then the EU.

---

## 10. Metrics (v1)

Measured with cookieless site analytics and GitHub, never with anything inside the signatures.

| Metric | Target (3 months after launch) |
|---|---|
| Time to first installed signature | < 3 min to build; < 5 min including hosting |
| Signatures exported | 5,000 |
| Path B (GitHub Pages) publishing success rate | > 95% |
| GitHub stars | 1,000 |
| Docker pulls | 500 |
| Compat matrix pass rate | 100% of shipped designs |
| Hosting or team feature requests | Tracked in GitHub Discussions, as the cloud go signal |

## 11. Risks

| Risk | Mitigation |
|---|---|
| The CDN goes down, breaking images in every email already sent | Multi-region CDN, long cache TTLs, text always kept in HTML |
| Email clients change how they render | Compat matrix every release; the public compat page builds trust |
| Mobile mail apps change or restrict signature setup | "Send to my phone" page and guides updated every release; the Gmail web-signature fallback for mobile |
| Apple Mail's paste flow drops formatting | `.mailsignature` file route on macOS; the shake-to-undo step on iOS |
| Wide designs overflow on phone screens | Main block ≤ 400 px; strips scale with `max-width`; phone-width preview in CI screenshots |
| Microsoft signature deployment is limited | Be clear about it; use a PowerShell script now and an Outlook add-in later |
| Non-technical users get stuck on hosting | Path B (one click) plus the ZIP fallback; a hosting troubleshooting guide |
| Users don't realize the GitHub Pages repo is public | Clear notice before publishing; optional custom domain |
| GitHub changes its Pages or App APIs, or objects to the usage | Path A and the ZIP fallback remain; monitor GitHub's terms and API changelog |
| A user deletes their repo or bucket, breaking images in sent emails | Warnings in the guide and in the builder |
| Competitors fork the hosted product | AGPL on the apps; brand and community as the moat |
| Abuse: phishing signatures, NSFW images | Moderation, rate limits, reporting |
| Storage costs grow | R2 has no egress fees; cap free-tier storage; content-hash deduplication |
| Solo-maintainer burnout | Start with a narrow v1, and put contributor docs and CI gates in place early |

---

## 12. Immediate next steps

1. Check the name: MailMotion as a trademark, domain and GitHub org.
2. Create the monorepo with the MIT/AGPL split, CLA, CI, `CONTRIBUTING.md` and `SECURITY.md`.
3. Extract the serializer from the Signet build into `packages/serializer`, with snapshot tests.
4. Port one design (Aurora) to the in-browser GIF renderer. Test installing and receiving it in Gmail, Outlook and Apple Mail on web, desktop, iPhone and Android.
5. **Spike Path B early:** register a GitHub App, build the Worker token exchange, and publish a test GIF to GitHub Pages from the browser. It's the least familiar piece, so prove it works well before week 8.
6. Put up a landing page with a waitlist and a GitHub "watch" link.
