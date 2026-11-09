import { OrderNotFoundError, OrderReorderAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { addVariants } from '../../services/cart';
import { orderOfCustomer } from '../../services/order';

/** A line Vendure can no longer sell is reported as that line's outcome, not thrown. */
export default defineVendureAction(OrderReorderAction, async ({ context, input }) => {
  const order = await orderOfCustomer(context.vendureClient, input.orderId);
  if (!order) throw new OrderNotFoundError(input.orderId);

  const outcomes = await addVariants(
    context.vendureClient,
    context.catalogClient,
    order.lines.map((line) => ({ productId: line.productVariant.productId, variantId: line.productVariant.id, quantity: line.quantity }))
  );
  return { items: outcomes.map((outcome) => outcome.item) };
});
