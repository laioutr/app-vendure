/* eslint-disable import-x/export, @typescript-eslint/no-empty-object-type */
import { createResolver, defineNuxtModule, installModule } from '@nuxt/kit';
import { defu } from 'defu';
import { registerLaioutrApp } from '@laioutr-core/kit';
import type { NuxtModule } from '@nuxt/schema';
import { name, version } from '../package.json';

/**
 * The options the module adds to the nuxt.config.ts, and the fields of `laioutr.manifest.json`.
 */
export interface ModuleOptions {
  /** The Shop API endpoint, e.g. `https://shop.example.com/shop-api`. */
  shopApiUrl: string;
  /**
   * Channel token sent as the `vendure-token` header. Unset serves the default channel.
   */
  channelToken?: string;
  /**
   * Language sent as `?languageCode=` on every request. Unset sends the visitor's language.
   */
  languageCode?: string;
  /**
   * The Admin API endpoint, e.g. `https://shop.example.com/admin-api`. With `adminApiKey`, it opens
   * the shop's texts to translation and its assets to the media library.
   */
  adminApiUrl?: string;
  /** An Admin API key of a role with the permissions the README lists. */
  adminApiKey?: string;
}

/**
 * The config the module adds to nuxt.runtimeConfig.public['@laioutr/app-vendure']
 */
export interface RuntimeConfigModulePublic {}

/**
 * The config the module adds to nuxt.runtimeConfig['@laioutr/app-vendure'].
 *
 * Server-only: the channel token selects prices and stock of a channel, and the Admin API key writes
 * the catalog, so neither reaches the browser.
 */
export interface RuntimeConfigModulePrivate extends ModuleOptions {}

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: name,
  },
  defaults: {
    shopApiUrl: '',
  },
  async setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url);
    const resolveRuntimeModule = (path: string) => resolve('./runtime', path);

    nuxt.options.build.transpile.push(resolve('./runtime'));

    nuxt.options.runtimeConfig[name] = defu(nuxt.options.runtimeConfig[name] as Parameters<typeof defu>[0], options);
    nuxt.options.runtimeConfig.public[name] = defu(nuxt.options.runtimeConfig.public[name] as Parameters<typeof defu>[0], {});

    nuxt.options.nitro.publicAssets ??= [];
    nuxt.options.nitro.publicAssets.push({
      dir: resolveRuntimeModule('./app/public'),
      maxAge: 60 * 60 * 24 * 7,
    });

    // Translation and the media library need the Admin API; without its two settings neither is
    // offered, rather than offered and failing on every call.
    const hasAdminApi = !!(options.adminApiUrl && options.adminApiKey);

    await registerLaioutrApp({
      name,
      version,
      orchestrDirs: [resolveRuntimeModule('server/orchestr'), ...(hasAdminApi ? [resolveRuntimeModule('server/admin/source-entities')] : [])],
      mediaLibraryProviders: hasAdminApi ? [resolveRuntimeModule('server/admin/media-library')] : [],
      nuxtImageProviders: {
        vendure: {
          name: 'vendure',
          provider: resolveRuntimeModule('./app/image/providers/vendure'),
        },
      },
    });

    // Peer modules are installed on prepare only, so `#imports` resolves for the typecheck; a
    // storefront lists them itself, as the playground does.
    if (nuxt.options._prepare) {
      for (const peer of ['@laioutr-core/frontend-core', '@laioutr-core/orchestr', '@nuxt/image']) await installModule(peer);
    }
  },
});

export default module;

export * from './globalExtensions';
