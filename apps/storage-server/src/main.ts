import { serve } from '@hono/node-server';
import { createAdapterFromEnv } from '@mailmotion/storage/node';
import { createApp } from './app';

const env = process.env;
const port = Number(env.PORT ?? 8787);

const adapter = createAdapterFromEnv({
  ...env,
  MM_PUBLIC_BASE_URL: env.MM_PUBLIC_BASE_URL ?? `http://localhost:${port}`,
});

const app = createApp(
  {
    uploadToken: env.MM_UPLOAD_TOKEN ?? '',
    allowedOrigins: (env.MM_ALLOWED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    dataDir: env.MM_DATA_DIR ? env.MM_DATA_DIR.replace(/\/files\/?$/, '') : './.data',
    trustProxy: env.MM_TRUST_PROXY === '1',
    maxUploadBytes: env.MM_MAX_UPLOAD_BYTES ? Number(env.MM_MAX_UPLOAD_BYTES) : undefined,
  },
  adapter,
);

const server = serve({ fetch: app.fetch, port, hostname: env.HOST ?? '0.0.0.0' }, (info) => {
  console.log(`MailMotion storage server (${adapter.kind}) listening on :${info.port}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
