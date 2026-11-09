import { CartRemoveItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import { couponCodeOfItemId } from '../../mappers/order';
import { defineVendureAction } from '../../middleware/defineVendure';
import { removeCoupon, removeLine } from '../../services/cart';

export default defineVendureAction(CartRemoveItemsAction, async ({ context, input }) => {
  for (const itemId of input) {
    const coupon = couponCodeOfItemId(itemId);
    await (coupon ? removeCoupon(context.vendureClient, coupon) : removeLine(context.vendureClient, itemId));
  }
});
