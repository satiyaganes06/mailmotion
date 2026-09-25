import { defineConfig, devices } from '@playwright/test';

const WEB = 'http://localhost:3300';
const TOKEN = 'e2e-upload-token-0123456789abcdef';

/**
 * End-to-end tests run against the *production* static export (with its strict CSP) and a real
 * storage server. Build first, with the auto-upload button wired to that storage server (its
 * MM_UPLOAD_TOKEN must match TOKEN above — NEXT_PUBLIC_* vars are baked in at build time, so this
 * can't be set later at webServer/runtime):
 *
 *   NEXT_PUBLIC_UPLOAD_ENDPOINT=http://localhost:8787 \
 *   NEXT_PUBLIC_UPLOAD_TOKEN=e2e-upload-token-0123456789abcdef \
 *   pnpm --filter @mailmotion/web build
 */
export default defineConfig({
  testDir: './test/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: WEB, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] },
      testIgnore: /mobile/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
  webServer: [
    {
      command: 'node scripts/serve-out.mjs',
      env: { PORT: '3300' },
      url: `${WEB}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @mailmotion/storage-server start',
      cwd: '../..',
      env: {
        PORT: '8787',
        MM_UPLOAD_TOKEN: TOKEN,
        MM_DATA_DIR: '.data-e2e/files',
        MM_ALLOWED_ORIGINS: WEB,
        MM_PUBLIC_BASE_URL: 'http://localhost:8787',
      },
      url: 'http://localhost:8787/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
