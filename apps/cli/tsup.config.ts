import { cpSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

// One self-contained file (workspace packages ship TypeScript sources). The native canvas stays an
// npm dependency; the fonts are copied next to the bundle.
export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  noExternal: [
    /^@mailmotion\//,
    'zod',
    'opentype.js',
    'gifenc',
    'fflate',
    'omggif',
    'simple-icons',
  ],
  external: ['@napi-rs/canvas'],
  banner: { js: '#!/usr/bin/env node' },
  onSuccess: async () => {
    mkdirSync('dist/fonts', { recursive: true });
    cpSync('../../packages/ink/fonts', 'dist/fonts', {
      recursive: true,
      filter: (s) => !s.endsWith('.md'),
    });
  },
});
