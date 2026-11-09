import { OrderByIdQuery } from '@laioutr-core/canonical-types/ecommerce';
import { ordersToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { orderOfCustomer } from '../../services/order';

// Vendure answers only the signed-in customer's orders; anyone else's is not found. No cache.
export default defineVendureQuery(OrderByIdQuery, async ({ context, input, passthrough, notFound }) => {
  const order = await orderOfCustomer(context.vendureClient, input.orderId);
  if (!order) return notFound();
  passthrough.set(ordersToken, [order]);
  return { id: order.id };
});
