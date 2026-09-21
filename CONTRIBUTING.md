# Contributing to MailMotion

Thanks for helping. MailMotion produces email signatures that have to survive Gmail, Outlook and
Apple Mail, so changes are held to a few hard rules.

## Setup

```bash
corepack enable
pnpm install
pnpm test        # every package
pnpm typecheck
pnpm --filter @mailmotion/web dev
```

Requires Node 20+ (22 recommended) and pnpm 10.

## Ground rules

- **Output must stay email-safe.** Tables and inline styles only. No `<script>`, no `<style>` blocks,
  no `javascript:` URLs. The serializer lint and injection tests enforce this.
- **Budgets are tests.** Signature HTML <= 10,000 characters, each GIF <= 300 KB, <= 12 fps,
  frame 1 complete. If you add an animation or layout, the property tests must still pass.
- **Frame 1 is the complete state.** Classic Outlook 2016/2019 shows only the first frame.
- **No tracking.** No pixels, no open tracking, nothing per-recipient.
- Add or update tests with every behaviour change.

## Developer Certificate of Origin (DCO)

Sign every commit off with `git commit -s`. That adds a `Signed-off-by:` line certifying that you
wrote the change or have the right to submit it under the project licence
(<https://developercertificate.org>). CI checks this on pull requests.

## Adding a design

A design is a preset: a layout + avatar animation + signature style + default theme.
Add it in `packages/presets`, add a snapshot test, and add it to the compatibility matrix in
`docs/compat`. Community designs must not imitate a real brand.

## Pull requests

1. Branch from `main` (`feature/<topic>`).
2. Keep PRs focused; one feature per PR.
3. `pnpm test && pnpm typecheck && pnpm format:check` must pass.
