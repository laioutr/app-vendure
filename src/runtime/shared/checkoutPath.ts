import type { LinkUrl } from '@laioutr-core/core-types/common';

/** Where the cart's Checkout button leads while the `checkoutPath` setting is empty. */
export const DEFAULT_CHECKOUT_PATH = '/checkout';

/**
 * The cart's checkout link for the `checkoutPath` setting: a path on the storefront's own domain, or
 * a full URL. A path typed without its leading slash still leads to the page, not to a path relative
 * to whatever page the cart is opened on.
 */
export const checkoutLinkOf = (setting: string | undefined): LinkUrl => {
  const path = setting?.trim() || DEFAULT_CHECKOUT_PATH;
  return { type: 'url', href: /^(https?:)?\/\//i.test(path) || path.startsWith('/') ? path : `/${path}` };
};
