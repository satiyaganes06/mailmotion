---
title: GitHub Pages publishing
order: 4
---

# GitHub Pages publishing (Path B)

> **Not currently in the builder UI.** The Install step now only offers the storage server
> configured for this deployment (`NEXT_PUBLIC_UPLOAD_ENDPOINT`/`NEXT_PUBLIC_UPLOAD_TOKEN`, see
> [Self-hosting](./self-hosting.md)) plus a ZIP download. The code and tests below are unchanged
> and still work — `apps/mock-github` and `apps/publish-fn` still run — but nothing in the shipped
> UI links to it. Wire `HostStep`'s component back up to `lib/github-flow.ts` if you want this path.

The builder can publish your images to a GitHub Pages site in **your own account**. There is no MailMotion server that stores your files.

## What happens when you press Publish

1. You sign in with GitHub (OAuth with PKCE and a `state` check).
2. The builder uses your token, in the browser, to commit all new images to `mailmotion-signatures` in **one commit** using the Git Data API.
3. It turns on GitHub Pages for that repo and waits until every image URL really loads (usually about a minute).
4. Your signature HTML is generated with `https://<you>.github.io/mailmotion-signatures/<hash>.gif` URLs.

Later edits add new hashed files to the same repo. Old files are never deleted or rewritten, so emails you already sent keep working.

## Things to know

- On free GitHub accounts Pages needs a **public repository**. Your avatar, signature mark and name are then public there. (They are in every email you send anyway.) The builder asks you to confirm before publishing.
- Deleting the repo breaks the images in emails you already sent.
- GitHub Pages has soft limits (about 100 GB/month bandwidth, 1 GB per site), far above what signatures need.
- **GitHub Apps cannot create repositories in a personal account.** If `mailmotion-signatures` does not exist, the builder shows a guided link to create it (public), and asks you to install the app on it.
- The user token lives **in browser memory only**: never in localStorage, IndexedDB or a cookie. It is gone when you close the tab and expires after 8 hours.

## Setting it up for your own deployment

You need a GitHub App and one tiny function (the token exchange needs the client secret).

1. **Register a GitHub App** (Settings → Developer settings → GitHub Apps):
   - Callback URL: `https://<your builder>/publish/callback/`
   - Repository permissions: **Contents: Read & write**, **Pages: Read & write**, **Metadata: Read-only**. (Administration is only needed if you want the app to create repos in an organisation.)
   - Enable **Request user authorization (OAuth) during installation**; leave webhooks off.
   - Note the **Client ID** and generate a **Client secret**.
2. **Deploy `apps/publish-fn`** to Cloudflare Workers (`wrangler deploy`; set the secret with `wrangler secret put GITHUB_APP_CLIENT_SECRET`) or run it on Node (`pnpm --filter @mailmotion/publish-fn start`). Set `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `ALLOWED_ORIGINS` (your builder's origin).
3. **Build the site** with:
   - `NEXT_PUBLIC_GITHUB_APP_CLIENT_ID`, `NEXT_PUBLIC_GITHUB_APP_SLUG`, `NEXT_PUBLIC_PUBLISH_FN_URL`.

The function checks the caller's origin and `redirect_uri`, rate-limits, requires PKCE, returns only the token fields, and logs nothing.

## Trying it locally without a GitHub App

`apps/mock-github` is an in-memory GitHub (OAuth + PKCE, Git Data API, Pages with a simulated build delay) so the whole flow runs on your machine:

```bash
pnpm --filter @mailmotion/mock-github start        # :8790
GITHUB_APP_CLIENT_ID=mock-client-id GITHUB_APP_CLIENT_SECRET=mock-secret \
  ALLOWED_ORIGINS=http://localhost:3100 GITHUB_OAUTH_BASE=http://localhost:8790 \
  pnpm --filter @mailmotion/publish-fn start        # :8788
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=mock-client-id NEXT_PUBLIC_PUBLISH_FN_URL=http://localhost:8788 \
NEXT_PUBLIC_GITHUB_OAUTH_BASE=http://localhost:8790 NEXT_PUBLIC_GITHUB_API_BASE=http://localhost:8790 \
NEXT_PUBLIC_GITHUB_PAGES_TEMPLATE='http://localhost:8790/pages/{owner}/{repo}' \
  pnpm --filter @mailmotion/web dev
```

The mock only mimics the parts MailMotion uses. **Do a real end-to-end check against github.com before relying on this path.**
