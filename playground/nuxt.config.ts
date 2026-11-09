import { fileURLToPath } from 'node:url';
import srcModule from '../src/module';

export default defineNuxtConfig({
  modules: [srcModule, '@pinia/nuxt', '@laioutr-core/frontend-core', '@laioutr-core/orchestr', '@laioutr-core/devtools'],
  alias: {
    '@laioutr/app-vendure': fileURLToPath(new URL('../src', import.meta.url)),
  },
  devtools: { enabled: true },
  telemetry: false,
  compatibilityDate: '2024-11-11',
  '@laioutr/app-vendure': {
    // Vendure's public read-only demo: no credentials, carts allowed, data reset regularly.
    shopApiUrl: process.env.VENDURE_SHOP_API_URL ?? 'https://readonlydemo.vendure.io/shop-api',
    channelToken: process.env.VENDURE_CHANNEL_TOKEN,
    languageCode: process.env.VENDURE_LANGUAGE_CODE,
    // Translation and the media library are registered only with both; the demo grants no Admin API key.
    adminApiUrl: process.env.VENDURE_ADMIN_API_URL,
    adminApiKey: process.env.VENDURE_ADMIN_API_KEY,
  },
});
