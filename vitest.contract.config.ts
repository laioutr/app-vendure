import { defineConfig } from 'vitest/config';

/**
 * Contract tests against a live Vendure Shop API — by default Vendure's public read-only demo. They
 * prove the documents and mappers still match a real server, so they are kept out of `pnpm test`.
 *
 * `VENDURE_CONTRACT_SHOP_API_URL` points them elsewhere; `VENDURE_CONTRACT_EMAIL` and
 * `VENDURE_CONTRACT_PASSWORD` name a verified customer for the signed-in tests, which are skipped
 * without them (the demo requires email verification, so no account can be created there).
 */
export default defineConfig({
  test: {
    include: ['test/contract/**/*.contract.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One server, one visitor session per file: files run one after another.
    fileParallelism: false,
    // The demo runs on SQLite and now and then answers "database is locked" under load.
    retry: 2,
  },
});
