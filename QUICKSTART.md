# MailMotion: Quick Start Guide

Get MailMotion running locally in minutes.

## Prerequisites

- **Node.js 18+** and **pnpm 9+** installed
- macOS (Docker not required for development)
- Optional: A Supabase project with S3-compatible storage enabled

## One-Minute Start (Mock GitHub + Local Builder)

```bash
# Clone and install
git clone https://github.com/satiyaganes06/mailmotion.git
cd mailmotion
pnpm install
pnpm prepare  # Generate gallery, fonts, icons

# Start all services (mock GitHub for Path B testing)
./scripts/start-all.sh

# Open your browser → http://localhost:3100
```

That's it. The builder is live, mock GitHub is running on :8790, and you can test the full GitHub publish flow (Path B) without touching your real account.

---

## Three Ways to Run It

### 1️⃣ **Mock GitHub** (default)
Full GitHub Pages flow locally, no authentication needed.

```bash
./scripts/start-all.sh
```

**What's running:**
- Builder dev server (`:3100`)
- Mock GitHub OAuth + Git Data API (`:8790`)
- Publish function (`:8788`)

**Use for:** Testing GitHub publish (Path B) end-to-end.

---

### 2️⃣ **Supabase Storage** (your own bucket)
Bring your own S3-compatible storage backend.

```bash
export MM_STORAGE=supabase
export MM_S3_ENDPOINT=https://<your-project>.supabase.co/storage/v1/s3
export MM_S3_REGION=ap-northeast-2
export MM_S3_BUCKET=mailmotion
export MM_S3_ACCESS_KEY_ID=<your-key>
export MM_S3_SECRET_ACCESS_KEY=<your-secret>
export MM_PUBLIC_BASE_URL=https://<your-project>.supabase.co/storage/v1/object/public/mailmotion
export MM_ALLOWED_ORIGINS=http://localhost:3100

./scripts/start-all.sh supabase
```

Then in the builder:
1. Go **Install** → **Host your images** → **Your storage**
2. Enter `http://localhost:8787` and a bearer token
3. Click **Upload images**

**Use for:** Testing real S3-compatible backends (Supabase, MinIO, Cloudflare R2).

---

### 3️⃣ **Production Static Export** (no services)
Just the built site, served statically.

```bash
./scripts/start-all.sh prod
```

Opens on `:3200`, no dynamic uploads or GitHub flow. Images use placeholder URLs.

---

## Ports and Services

| Port | Service | Purpose |
|------|---------|---------|
| 3100 | Builder (dev) | The editor UI |
| 3200 | Builder (prod) | Static export viewer |
| 8787 | Storage server | Upload endpoint (Path A) |
| 8788 | Publish function | GitHub token exchange |
| 8790 | Mock GitHub | OAuth + Git Data API |

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

**Start only the storage server (with Supabase):**
```bash
MM_STORAGE=supabase MM_S3_* ... pnpm --filter @mailmotion/storage-server start
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
4. **Host**: Choose GitHub Pages, Supabase, or your own server
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
- ✅ Mock GitHub flow (OAuth, Git Data API, Pages)
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
