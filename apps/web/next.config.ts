import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), '..', '..'),
  // The hosted builder is a static site: editing, rendering and export all run in the browser.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@mailmotion/animations',
    '@mailmotion/contrast',
    '@mailmotion/icons',
    '@mailmotion/ink',
    '@mailmotion/layouts',
    '@mailmotion/presets',
    '@mailmotion/renderer',
    '@mailmotion/schema',
    '@mailmotion/serializer',
    '@mailmotion/storage',
  ],
};

export default config;
