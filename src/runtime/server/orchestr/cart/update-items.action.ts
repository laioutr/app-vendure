import { CartUpdateItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import { couponCodeOfItemId } from '../../mappers/order';
import { defineVendureAction } from '../../middleware/defineVendure';
import { adjustLine } from '../../services/cart';

/** Coupon rows and custom fields have nothing to update in Vendure, so they are left as they are. */
export default defineVendureAction(CartUpdateItemsAction, async ({ context, input }) => {
  const messages = [];
  for (const item of input) {
    if (typeof item.quantity !== 'number' || couponCodeOfItemId(item.itemId)) continue;
    const message = await adjustLine(context.vendureClient, item.itemId, item.quantity);
    if (message) messages.push(message);
  }
  return messages.length ? { messages } : undefined;
});
