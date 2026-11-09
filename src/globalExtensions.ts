import type { RuntimeConfigModulePrivate, RuntimeConfigModulePublic } from './module';

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    ['@laioutr/app-vendure']: RuntimeConfigModulePublic;
  }
  interface RuntimeConfig {
    ['@laioutr/app-vendure']: RuntimeConfigModulePrivate;
  }
}

export {};
