import { CartAddItemsAction, CartRemoveItemsAction, CartUpdateItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import type { ActionToken } from '@laioutr-core/core-types/orchestr';

const CART_CHANGES: ReadonlySet<ActionToken> = new Set([CartAddItemsAction, CartUpdateItemsAction, CartRemoveItemsAction]);

/** Whether a finished action changed the cart — in the header's cart, a product page, anywhere on the page. */
export const isCartChange = (token: ActionToken) => CART_CHANGES.has(token);
