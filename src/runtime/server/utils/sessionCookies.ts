import { placedOrdersSecret, readPlacedOrders, withPlacedOrder } from './placedOrders';
import { PLACED_ORDERS_COOKIE, PLACED_ORDERS_COOKIE_MAX_AGE, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from '../const';

/** The cookies of one request, as h3 and frontend-core read and write them. */
export interface CookieJar {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options: Record<string, unknown>) => void;
  delete: (name: string, options: Record<string, unknown>) => void;
  /** A query streams its answer and may have sent its headers before a cookie is due. */
  readonly headersSent: boolean;
}

// Lax rather than Strict: a visitor arriving from a link in an email (a password reset, an order
// confirmation) must arrive with their session. Lax still withholds the cookie from cross-site POSTs.
// `secure` is left to frontend-core's managed cookies, which set it from the request's origin.
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

/** The storefront's own cookies for Vendure: the session, and the orders this browser placed. */
export const sessionCookies = (jar: CookieJar, projectSecret: unknown) => {
  const readPlacedOrderCodes = () => readPlacedOrders(jar.get(PLACED_ORDERS_COOKIE), placedOrdersSecret(projectSecret));

  return {
    readSessionToken: () => jar.get(SESSION_COOKIE) || undefined,

    /**
     * Persists a session token Vendure issued. Once a streamed answer has sent its headers, the token
     * is kept for the rest of the request only, and Vendure issues it again on the next call that
     * needs a session.
     */
    writeSessionToken: (token: string) => {
      if (!jar.headersSent) jar.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_COOKIE_MAX_AGE });
    },

    clearSessionToken: () => {
      if (!jar.headersSent) jar.delete(SESSION_COOKIE, { path: COOKIE_OPTIONS.path });
    },

    readPlacedOrderCodes,

    /** Remembers that this browser placed the order, so its confirmation page may read it. */
    rememberPlacedOrder: (code: string) => {
      if (jar.headersSent) return;
      const value = withPlacedOrder(readPlacedOrderCodes(), code, placedOrdersSecret(projectSecret));
      jar.set(PLACED_ORDERS_COOKIE, value, { ...COOKIE_OPTIONS, maxAge: PLACED_ORDERS_COOKIE_MAX_AGE });
    },
  };
};
