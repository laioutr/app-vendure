import { CartAddItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { addVariants, applyCoupon } from '../../services/cart';

const notSupported = (reasonLabel: string) => ({ status: 'rejected' as const, reason: 'not-supported', reasonLabel });

/** Product rows go to Vendure in one batch, then coupons, which apply to what the cart then holds. */
export default defineVendureAction(CartAddItemsAction, async ({ context, input }) => {
  const products = input.flatMap((row, index) =>
    row.type === 'product' && !row.subscription ? [{ index, row: { productId: row.productId, variantId: row.variantId, quantity: row.quantity } }] : []
  );
  const added = await addVariants(
    context.vendureClient,
    context.catalogClient,
    products.map(({ row }) => row)
  );
  const outcomes = new Map(products.map(({ index }, position) => [index, added[position]!]));

  const items = [];
  const messages = [];
  for (const [index, row] of input.entries()) {
    const outcome = outcomes.get(index);
    if (outcome) {
      items.push(outcome.item);
      if (outcome.message) messages.push(outcome.message);
    } else if (row.type === 'product') {
      items.push({ ...notSupported('Vendure sells no subscriptions.'), productId: row.productId, variantId: row.variantId });
    } else if (row.type === 'discount-code') {
      items.push(await applyCoupon(context.vendureClient, row.code));
    } else if (row.type === 'sku') {
      items.push({ ...notSupported('Adding by SKU is not supported for Vendure.'), sku: row.sku });
    } else {
      items.push(notSupported('Custom items are not supported for Vendure.'));
    }
  }

  return { items, messages: messages.length ? messages : undefined };
});
