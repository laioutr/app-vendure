import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PLACED_ORDERS_KEPT } from '../const';

/**
 * Order codes this browser placed, as one signed cookie value. Signed because Vendure answers a
 * guest's order to anyone who has its code for a while; the cookie is what tells the browser that
 * placed it from one that only learned the code, and a cookie anyone could write would tell nothing.
 */
const SEPARATOR = '~';

const signatureOf = (secret: string, codes: string) =>
  createHmac('sha256', secret).update(`vendure-placed-orders:${codes}`).digest('base64url');

/** The codes a cookie value carries, or none when it is missing, malformed or not signed with `secret`. */
export const readPlacedOrders = (value: string | undefined, secret: string): string[] => {
  const dot = value?.lastIndexOf('.') ?? -1;
  if (!value || dot < 1) return [];
  const codes = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(signatureOf(secret, codes));
  return given.length === expected.length && timingSafeEqual(given, expected) ? codes.split(SEPARATOR) : [];
};

/** The cookie value after placing `code`: the latest codes, newest last, signed. */
export const withPlacedOrder = (codes: readonly string[], code: string, secret: string): string => {
  const kept = [...codes.filter((known) => known !== code), code].slice(-PLACED_ORDERS_KEPT).join(SEPARATOR);
  return `${kept}.${signatureOf(secret, kept)}`;
};

/**
 * The order a confirmation reads: the code asked for, else the newest this browser placed; and whether
 * this browser placed it. Nothing when no code is asked for and none was placed here.
 */
export const placedOrderToShow = (requested: string | undefined, placedCodes: readonly string[]) => {
  const code = requested ?? placedCodes.at(-1);
  return code ? { code, placedHere: placedCodes.includes(code) } : undefined;
};

let processSecret: string | undefined;

/**
 * The project's secret key, which every instance of a deployment shares. A storefront run without
 * one signs with a key of this process only: a confirmation page served by another instance then
 * answers not found, which is safe.
 */
export const placedOrdersSecret = (projectSecret: unknown): string => {
  if (typeof projectSecret === 'string' && projectSecret) return projectSecret;
  processSecret ??= randomBytes(32).toString('base64url');
  return processSecret;
};
