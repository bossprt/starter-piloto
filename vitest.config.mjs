import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'scripts/test/**/*.test.mjs'],
  },
});
