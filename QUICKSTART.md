# MailMotion: Quick Start Guide

Get MailMotion running locally in minutes.

## Prerequisites

- **Node.js 18+** and **pnpm 9+** installed
- macOS (Docker not required for development)
- A storage server for images: disk (zero setup), or S3/R2/MinIO/Supabase (see [Self-hosting](docs/self-hosting.md))

## One-Minute Start

```bash
# Clone and install
git clone https://github.com/satiyaganes06/mailmotion.git
cd mailmotion
pnpm install
pnpm prepare  # Generate gallery, fonts, icons

# Copy the env template and fill in your storage backend (disk works with no edits)
cp .env.example .env

# Start the storage server + builder
./scripts/start-all.sh

# Open your browser → http://localhost:3100
```

The builder's **Install → Upload images** button is now wired straight to your storage server —
nothing to type in. If you left `NEXT_PUBLIC_UPLOAD_ENDPOINT`/`NEXT_PUBLIC_UPLOAD_TOKEN` unset in
`.env`, that button won't appear; set them (see below) and restart.

---

## Ways to Run It

### 1️⃣ **Storage + builder** (default)

The normal way to run this: a storage server backed by whatever `.env` says (`disk` by default,
or your own S3/R2/MinIO/Supabase bucket), and the builder pointed at it.

```bash
./scripts/start-all.sh
```

**What's running:**

- Storage server (`:8787`) — backend controlled by `MM_STORAGE` in `.env`
- Builder dev server (`:3100`) — its "Upload images" button auto-targets that server via
  `NEXT_PUBLIC_UPLOAD_ENDPOINT`/`NEXT_PUBLIC_UPLOAD_TOKEN`, also set in `.env`

**Use for:** normal day-to-day development and testing the full render → upload → copy flow.

**Security note:** those `NEXT_PUBLIC_*` values ship in the built JS — fine for local dev and a
single-tenant deployment you and your team use, not for a public multi-tenant one. See
[Self-hosting](docs/self-hosting.md#wiring-the-builder-to-it-one-click-upload).

---

### 2️⃣ **Mock GitHub** (Path B, not in the UI right now)

The builder's Install step no longer has a GitHub Pages option — it was removed in favor of the
single auto-upload button above. The underlying code (`apps/mock-github`, `apps/publish-fn`,
`lib/github-flow.ts`) still works and is still tested; this just starts it standalone.

```bash
./scripts/start-all.sh github
```

See [docs/github-pages.md](docs/github-pages.md) if you want to wire it back into `HostStep`.

---

### 3️⃣ **Production Static Export**

Just the built site, served statically, using whatever `NEXT_PUBLIC_UPLOAD_*` was baked in at
build time.

```bash
./scripts/start-all.sh prod
```

Opens on `:3200`.

---

## Ports and Services

| Port | Service          | Purpose                                     |
| ---- | ---------------- | ------------------------------------------- |
| 3100 | Builder (dev)    | The editor UI                               |
| 3200 | Builder (prod)   | Static export viewer                        |
| 8787 | Storage server   | Upload endpoint the builder auto-uploads to |
| 8788 | Publish function | GitHub token exchange (`github` mode only)  |
| 8790 | Mock GitHub      | OAuth + Git Data API (`github` mode only)   |

---

## What Gets Built

```
mailmotion/
├── packages/                  # Core libraries (TypeScript)
│   ├── schema                 # Zod validation & config types
│   ├── presets                # 6 design templates
│   ├── renderer               # GIF/PNG encoding (Node + browser)
│   ├── animations             # Avatar animations (6 variants)
│   ├── storage                # S3/disk/GitHub adapters
│   ├── serializer             # HTML email generation
│   ├── layouts                # Signature templates
│   ├── contrast               # WCAG color contrast solver
│   └── ink                    # Signature vectorization & glyph shaping
├── apps/
│   ├── web                    # Next.js 15 App Router builder (the main UI)
│   ├── storage-server         # Bearer-token upload endpoint (Hono)
│   ├── publish-fn             # GitHub token exchange (Hono)
│   ├── mock-github            # In-memory GitHub mock (Hono)
│   └── cli                    # `npx mailmotion` CLI tool
└── docker/                    # Caddy + docker-compose for self-hosting
```

---

## Manual Commands (If You Don't Use the Script)

**Prepare assets once (generates gallery, fonts, icons):**

```bash
pnpm prepare
```

**Type-check all packages:**

```bash
pnpm typecheck
```

**Run all tests (350+ tests):**

```bash
pnpm test
```

**Build for production:**

```bash
pnpm --filter @mailmotion/web build
```

**Build the CLI:**

```bash
pnpm --filter mailmotion build
```

**Start only the builder dev server:**

```bash
pnpm --filter @mailmotion/web dev
```

**Start only the mock GitHub server:**

```bash
pnpm --filter @mailmotion/mock-github start
```

**Start only the storage server (reads `MM_*` from its environment):**

```bash
MM_STORAGE=supabase MM_S3_ENDPOINT=... MM_S3_BUCKET=... MM_UPLOAD_TOKEN=... \
  pnpm --filter @mailmotion/storage-server start
```

---

## Stop All Services

```bash
pkill -f "apps/mock-github|apps/publish-fn|apps/storage-server|@mailmotion/web"
```

Or if using the script, it auto-cleans on the next `./scripts/start-all.sh` call.

---

## First Time in the Builder

1. **Onboarding**: Pick a design (or skip)
2. **Edit**: Customize details, avatar, mark, colors, socials
3. **Preview**: See it on Gmail, Outlook, Apple Mail (desktop & mobile)
4. **Host**: Click **Upload images** (auto-configured), or fall back to **Download ZIP**
5. **Install**: Copy signature or download files

---

## Verification

After starting, confirm everything is up:

```bash
curl http://localhost:3100      # Builder
curl http://localhost:8787      # Storage server
curl http://localhost:8790/state # Mock GitHub state
```

---

## Troubleshooting

**Port already in use?**

```bash
lsof -i :3100  # or :8787, :8790, etc.
kill -9 <PID>
```

**Files not generated?**

```bash
rm -rf public/gallery public/fonts public/icons src/generated
pnpm prepare
```

**Next.js dev server won't start?**

```bash
rm -rf apps/web/.next
pnpm --filter @mailmotion/web dev
```

**Dependencies out of sync?**

```bash
rm -rf node_modules .pnpm-lock.yaml
pnpm install
```

---

## What's NOT Verified Yet

See [docs/compat/index.md](docs/compat/index.md) for what's been tested and what hasn't:

- ✅ Builder UI (dev + prod builds)
- ✅ Rendering (avatar, mark, layout, colors, typography)
- ✅ GIF encoding (12 fps, 300 KB budget)
- ✅ HTML serialization (Gmail/Outlook/Apple Mail email format)
- ✅ Storage (disk, S3, R2, MinIO, Supabase)
- ✅ Mock GitHub flow (OAuth, Git Data API, Pages) — but not currently reachable from the builder UI
- ⬜ Real GitHub against github.com (not tested, only mock)
- ⬜ Real mail clients (Gmail/Outlook/Apple Mail on devices)
- ⬜ Docker Compose build/up (daemon was unavailable)
- ⬜ .mailsignature install on macOS (unchecked)

---

## Next Steps

- Read [docs/github-pages.md](docs/github-pages.md) for real GitHub App setup
- Read [docs/self-hosting.md](docs/self-hosting.md) for production deployment
- See [docs/compat/index.md](docs/compat/index.md) for device testing checklist
- Explore [docs/](docs/) for design specs, CLI docs, and architecture notes

---

## Need Help?

- Check logs in `/tmp/mm-*.log`
- Open a GitHub issue at https://github.com/satiyaganes06/mailmotion/issues
- Read the [privacy](docs/privacy.md), [architecture](docs/architecture.md), or [install guides](docs/install/)
