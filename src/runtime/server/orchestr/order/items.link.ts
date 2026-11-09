import { OrderItemsLink } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureLink } from '../../middleware/defineVendure';
import { ordersFor } from '../../utils/orders';

export default defineVendureLink(OrderItemsLink, async ({ entityIds, context, passthrough }) => {
  const orders = await ordersFor(context.vendureClient, passthrough, entityIds);
  return {
    links: entityIds.flatMap((id) => {
      const order = orders.get(id);
      return order ? [{ sourceId: id, targetIds: order.lines.map((line) => line.id), entityTotal: order.lines.length }] : [];
    }),
  };
});
