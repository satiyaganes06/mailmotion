import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8788);
const app = createApp({
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000',
  GITHUB_OAUTH_BASE: process.env.GITHUB_OAUTH_BASE,
  RATE_PER_MINUTE: process.env.RATE_PER_MINUTE,
});

serve({ fetch: app.fetch, port }, () => console.log(`MailMotion publish function on :${port}`));
