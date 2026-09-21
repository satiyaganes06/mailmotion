import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],
    env: {
      NEXT_PUBLIC_GITHUB_APP_CLIENT_ID: 'mock-client-id',
      NEXT_PUBLIC_PUBLISH_FN_URL: 'http://fn.local',
      NEXT_PUBLIC_GITHUB_OAUTH_BASE: 'http://mock.local',
      NEXT_PUBLIC_GITHUB_API_BASE: 'http://mock.local',
      NEXT_PUBLIC_GITHUB_PAGES_TEMPLATE: 'http://mock.local/pages/{owner}/{repo}',
    },
  },
});
