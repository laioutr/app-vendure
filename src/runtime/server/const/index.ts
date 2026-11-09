import { name } from '../../../../package.json';

export const VENDURE_APP = name;

/**
 * Vendure answers a new or rotated session token in this response header (bearer mode). Vendure lets
 * a server rename it (`authOptions.authTokenHeaderKey`), but no Shop API query tells which name a
 * server chose, so the default is assumed.
 */
export const SESSION_TOKEN_RESPONSE_HEADER = 'vendure-auth-token';

/** Authenticates an Admin API key (Vendure 3.6 and later, with `'api-key'` among the token methods). */
export const API_KEY_REQUEST_HEADER = 'vendure-api-key';

/** Selects the channel; the default of `apiOptions.channelTokenKey`. */
export const CHANNEL_TOKEN_REQUEST_HEADER = 'vendure-token';

/**
 * The storefront's own http-only cookie holding the Vendure session. One token covers the active
 * order and the signed-in customer, so the cart and the login live and die together.
 */
export const SESSION_COOKIE = 'vendure-auth-token';

/** A year, like Vendure's own `rememberMe` session. Vendure decides when the session itself expires. */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Vendure's default `shopListQueryLimit`; a larger `take` is refused. */
export const MAX_PAGE_SIZE = 100;

/** The slug Vendure gives the hidden root of the collection tree. */
export const ROOT_COLLECTION_SLUG = '__root_collection__';

/**
 * How long one Shop API call may take. A Vendure server that accepts the connection and stalls would
 * otherwise hold every page render and action open until the platform kills the function; ten
 * seconds is far above a healthy answer and well inside a serverless function's limit.
 */
export const REQUEST_TIMEOUT_MS = 10_000;

/** The storefront's own http-only cookie listing the orders this browser placed, signed. */
export const PLACED_ORDERS_COOKIE = 'vendure-placed-orders';

/**
 * A day: the confirmation page is read right after payment, and Vendure itself stops answering a
 * guest's order by code after a couple of hours.
 */
export const PLACED_ORDERS_COOKIE_MAX_AGE = 60 * 60 * 24;

/** Only the latest few placed orders are remembered, so the cookie stays small. */
export const PLACED_ORDERS_KEPT = 5;
