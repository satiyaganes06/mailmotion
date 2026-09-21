import { defineConfig } from 'tsup';

// Bundle workspace packages (they ship TypeScript sources) into one runnable file.
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  noExternal: [/^@mailmotion\//],
  external: ['@aws-sdk/client-s3'],
});
