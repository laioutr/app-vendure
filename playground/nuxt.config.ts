import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import srcModule from '../src/module';

// A local `laioutrrc.json` (git-ignored, e.g. one pulled from a project) wins over the committed example storefront.
const rcPath = ['laioutrrc.json', 'laioutrrc.example.json']
  .map((file) => fileURLToPath(new URL(file, import.meta.url)))
  .find((path) => existsSync(path))!;
const laioutrrc = JSON.parse(readFileSync(rcPath, 'utf8'));
// The playground calls only its own server, which needs no project secret for that.
laioutrrc.laioutr.projectSecretKey = false;

export default defineNuxtConfig({
  // The app goes first, as a storefront installs its apps: frontend-core collects their image providers once, after them.
  modules: [srcModule, '@pinia/nuxt', '@laioutr-core/frontend-core', '@laioutr-app/ui', '@laioutr-core/orchestr', '@laioutr-core/devtools'],
  alias: {
    '@laioutr/app-vendure': fileURLToPath(new URL('../src', import.meta.url)),
  },
  laioutr: {
    laioutrrc,
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
    checkoutPath: process.env.VENDURE_CHECKOUT_PATH,
    providerPaymentMethods: process.env.VENDURE_PROVIDER_PAYMENT_METHODS,
  },
});
