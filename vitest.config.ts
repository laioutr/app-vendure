import { defineConfig } from 'vitest/config';

/**
 * Unit tests are plain functions and classes, so they run in Node: booting the playground's Nuxt for
 * them would build the whole storefront it renders.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
