import { sessionCookies } from './sessionCookies';
import { deleteManagedCookie, getCookie, setManagedCookie, useRuntimeConfig } from '#imports';
import type { H3Event } from 'h3';

const cookiesOf = (event: H3Event) =>
  sessionCookies(
    {
      get: (name) => getCookie(event, name),
      set: (name, value, options) => setManagedCookie(event, name, value, options),
      delete: (name, options) => deleteManagedCookie(event, name, options),
      get headersSent() {
        return event.node.res.headersSent;
      },
    },
    useRuntimeConfig().laioutr?.projectSecretKey
  );

export const readSessionToken = (event: H3Event) => cookiesOf(event).readSessionToken();
export const writeSessionToken = (event: H3Event, token: string) => cookiesOf(event).writeSessionToken(token);
export const clearSessionToken = (event: H3Event) => cookiesOf(event).clearSessionToken();
export const readPlacedOrderCodes = (event: H3Event) => cookiesOf(event).readPlacedOrderCodes();
export const rememberPlacedOrder = (event: H3Event, code: string) => cookiesOf(event).rememberPlacedOrder(code);
