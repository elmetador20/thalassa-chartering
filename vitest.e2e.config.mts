import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// End-to-end: HTTP against the production build. Run `npm run build` first.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/support/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    name: 'e2e',
    include: ['tests/e2e/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/support/global-app.ts'],
    setupFiles: ['tests/support/db-env.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
