import { OrderAllQuery } from '@laioutr-core/canonical-types/ecommerce';
import { ordersToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { customerOrders } from '../../services/order';

// No cache: the orders belong to one customer.
export default defineVendureQuery(OrderAllQuery, async ({ context, pagination, passthrough }) => {
  const orders = await customerOrders(context.vendureClient, { skip: pagination.offset, take: pagination.limit });
  passthrough.set(ordersToken, orders.items);
  return { ids: orders.items.map((order) => order.id), total: orders.totalItems };
});
