import { VendureClient } from '../../src/runtime/server/client/VendureClient';

export const SHOP_API_URL = process.env.VENDURE_CONTRACT_SHOP_API_URL ?? 'https://readonlydemo.vendure.io/shop-api';

/** A client that keeps its own session across calls, as one visitor's cookie would. */
export const visitor = (options: { languageCode?: string; currencyCode?: string } = {}) => {
  let token: string | undefined;
  const client = (): VendureClient =>
    new VendureClient({ apiUrl: SHOP_API_URL, ...options, sessionToken: token, onSessionToken: (issued) => (token = issued) });
  return { client, hasSession: () => !!token };
};
