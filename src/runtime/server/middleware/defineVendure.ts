import { vendureContext } from './vendureContext';
import { defineOrchestr, useRuntimeConfig } from '#imports';
import type { defineOrchestrMock } from '@laioutr-core/orchestr/types';
import { VENDURE_APP } from '../const';
import { readSessionToken, writeSessionToken } from '../utils/session';

// The cast keeps the published `.d.ts` typed: `defineOrchestr` comes from `#imports`, which the
// declaration builder cannot resolve, so without it every wrapper below is emitted as `any`.
export const defineVendure = (defineOrchestr as typeof defineOrchestrMock)
  .meta({
    app: VENDURE_APP,
    label: 'Vendure',
    logoUrl: '/app-vendure/vendure-logo.svg',
  })
  .extendRequest(async ({ event, clientEnv }) => ({
    context: await vendureContext(useRuntimeConfig()[VENDURE_APP], {
      market: clientEnv.market,
      localeChain: clientEnv.language.localeChain,
      sessionToken: readSessionToken(event),
      onSessionToken: (token) => writeSessionToken(event, token),
    }),
  }));

// Typed by query, so the declaration file names no orchestr type the package does not export.
export const defineVendureAction: typeof defineVendure.actionHandler = defineVendure.actionHandler;
export const defineVendureQuery: typeof defineVendure.queryHandler = defineVendure.queryHandler;
export const defineVendureLink: typeof defineVendure.linkHandler = defineVendure.linkHandler;
export const defineVendureComponentResolver: typeof defineVendure.componentResolver = defineVendure.componentResolver;
export const defineVendureQueryTemplateProvider: typeof defineVendure.queryTemplateProvider = defineVendure.queryTemplateProvider;
export const defineVendurePageIndex: typeof defineVendure.pageIndex = defineVendure.pageIndex;
export const defineVendureSourceEntity: typeof defineVendure.sourceEntity = defineVendure.sourceEntity;
export const defineVendureMediaLibrary: typeof defineVendure.mediaLibrary = defineVendure.mediaLibrary;
