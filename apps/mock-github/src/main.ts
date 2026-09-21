import { serve } from '@hono/node-server';
import { createMockGitHub } from './app';

const port = Number(process.env.PORT ?? 8790);
const baseUrl = process.env.MOCK_BASE_URL ?? `http://localhost:${port}`;

const mock = createMockGitHub({
  baseUrl,
  pagesDelayMs: Number(process.env.MOCK_PAGES_DELAY_MS ?? 3000),
  allowRepoCreate: process.env.MOCK_ALLOW_REPO_CREATE === '1',
});
// Start with the repo already created unless told otherwise, so the happy path works out of the box.
if (process.env.MOCK_SEED_REPO !== '0') mock.seedRepo();

serve({ fetch: mock.app.fetch, port }, () => {
  console.log(`Mock GitHub on ${baseUrl}`);
  console.log(`  client id:     ${mock.cfg.clientId}`);
  console.log(`  client secret: ${mock.cfg.clientSecret}`);
  console.log(
    '  Point the publish function at it with GITHUB_OAUTH_BASE and the builder with NEXT_PUBLIC_GITHUB_API_BASE.',
  );
});
