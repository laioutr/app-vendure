import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    // The nuxt environment collects only `*.nuxt.test.ts` unless `include` is set.
    include: ['src/**/*.test.ts'],
    environmentOptions: {
      nuxt: { rootDir: './playground' },
    },
  },
});
