---
title: Self-hosting
order: 3
---

# Self-hosting (Path A)

The storage server receives images from the builder and serves them over HTTPS. It is a small stateless service.

## Quick start

```bash
cp .env.example .env
# edit .env: MM_UPLOAD_TOKEN, MM_PUBLIC_BASE_URL, MM_ALLOWED_ORIGINS
docker compose up
```

The compose file runs the builder, the storage server and Caddy (automatic HTTPS). Files are stored under content-hashed names (`<sha256>.gif`) with `Cache-Control: public, max-age=31536000, immutable`, so Gmail's image proxy picks up edits and old emails keep working.

> **Not verified in CI yet:** the Docker images and compose file could not be built in the environment they were written in (no Docker daemon). The storage server itself is tested and was smoke-tested as a bundled Node process. Please report problems with `docker compose up`.

## Wiring the builder to it (one-click upload)

The Install step's "Upload images" button uploads straight to whatever storage server this
deployment was **built** with — nothing for the person using the builder to type in. Set these
when you build the site (they must be present at `next build`/`next dev` time, not just at
runtime, since `NEXT_PUBLIC_*` values are baked into the shipped JS):

```bash
NEXT_PUBLIC_UPLOAD_ENDPOINT=https://img.example.com
NEXT_PUBLIC_UPLOAD_TOKEN=<the same value as MM_UPLOAD_TOKEN on that storage server>
```

**Security tradeoff:** these two values ship in the public JS bundle — anyone who loads the
builder can read them (view-source, devtools) and use the token to upload to your bucket. That's
fine for a **single-tenant** deployment (you run the builder and the storage server for your own
team, and everyone who can reach the site is meant to be able to upload). Don't set these on a
public multi-tenant deployment where strangers can load the builder; leave them unset there and
people can still use the "Download ZIP" fallback, or you can re-enable a per-user entry form (see
`apps/web/src/components/install/HostStep.tsx`) or GitHub Pages publishing (see
[GitHub Pages publishing](./github-pages.md)).

If they're left unset, the Install step shows a plain notice instead of a button and nothing is
uploaded anywhere automatically.

## Configuration

| Variable                                                                                           | Meaning                                                                                                               |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `MM_STORAGE`                                                                                       | `disk` (default), `s3`, `r2`, `minio` or `supabase`                                                                   |
| `MM_PUBLIC_BASE_URL`                                                                               | Public URL the images are served from (must be https in production)                                                   |
| `MM_UPLOAD_TOKEN`                                                                                  | Shared secret the builder sends to upload. At least 16 characters. The server refuses to start with the example value |
| `MM_ALLOWED_ORIGINS`                                                                               | Comma-separated origins allowed to call the upload API from a browser (your builder's address)                        |
| `MM_DATA_DIR`                                                                                      | Where disk storage keeps files (default `./.data/files`)                                                              |
| `MM_TRUST_PROXY`                                                                                   | Set to `1` behind Caddy/nginx so rate limiting uses `X-Forwarded-For`                                                 |
| `MM_S3_ENDPOINT`, `MM_S3_BUCKET`, `MM_S3_REGION`, `MM_S3_ACCESS_KEY_ID`, `MM_S3_SECRET_ACCESS_KEY` | S3-compatible settings. `r2` and `minio` also require `MM_S3_ENDPOINT`                                                |

### Cloudflare R2, S3 and MinIO

Set `MM_STORAGE=r2|s3|minio`, the `MM_S3_*` values, and put a public domain or CDN in front of the bucket as `MM_PUBLIC_BASE_URL`. Uploads still go through the server, so validation applies everywhere.

### Supabase Storage

Supabase Storage exposes an S3-compatible API, so it's just another `MM_STORAGE` mode — no GitHub Pages or Path B setup needed. In your Supabase project:

1. **Storage → New bucket.** Create one (e.g. `mailmotion`) and make it **public** — images in a signature have to be fetchable by every mail client, unauthenticated.
2. **Project Settings → Storage → S3 Connection → New access key.** Note the access key ID/secret and the region shown there.
3. Set:

   ```bash
   MM_STORAGE=supabase
   MM_S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
   MM_S3_REGION=<region from the S3 Connection panel>
   MM_S3_BUCKET=mailmotion
   MM_S3_ACCESS_KEY_ID=<access key id>
   MM_S3_SECRET_ACCESS_KEY=<access key secret>
   MM_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/mailmotion
   ```

Uploads still go through your storage server (sanitized, bearer-token gated, content-hashed) — Supabase only holds the bytes and serves them publicly. Not yet verified against a real Supabase project in this environment; the adapter is the same generic S3 client used for R2/MinIO with path-style addressing, but please confirm one real upload/read round trip before relying on it.

## What the server enforces

- Bearer-token upload (constant-time comparison), per-client rate limit.
- Only GIF and PNG. The type is sniffed from magic bytes; the declared type must match.
- Strict GIF/PNG parsing, byte, pixel and frame caps, then a rewrite that drops comments, EXIF/GPS, text and unknown application blocks. The stored name is the SHA-256 of the _sanitized_ file.
- Files are served with an explicit `Content-Type`, `X-Content-Type-Options: nosniff`, a sandboxing CSP, and no directory listing.
- "Send to my phone" shares live 24 hours, use a 128-bit random token, and are accepted only if the HTML passes the same lint the serializer enforces.

## Verifying

After an upload the builder fetches every image URL and checks the status and `Content-Type`. A misconfigured `MM_PUBLIC_BASE_URL` or proxy shows up immediately.
