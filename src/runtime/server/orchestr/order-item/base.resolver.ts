import { OrderItemBase, OrderItemCost, OrderItemFulfillment } from '@laioutr-core/canonical-types/entity/order-item';
import { ordersToken } from '../../const/passthroughTokens';
import { orderLineComponents } from '../../mappers/order';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { linesOf } from '../../utils/orders';

/** Order lines are read with their order; the Shop API has no read of a line on its own. */
export default defineVendureComponentResolver({
  entityType: 'OrderItem',
  label: 'Vendure Order Item Resolver',
  provides: [OrderItemBase, OrderItemCost, OrderItemFulfillment],
  cache: false,
  resolve: ({ entityIds, passthrough, $entity }) => {
    const lines = linesOf(passthrough.get(ordersToken) ?? []);

    const entities = entityIds.flatMap((id) => {
      const entry = lines.get(id);
      if (!entry) return [];
      const components = orderLineComponents(entry.line, entry.order);
      return [$entity({ id, base: () => components.base, cost: () => components.cost, fulfillment: () => components.fulfillment })];
    });

    return { entities, notFound: entityIds.filter((id) => !lines.has(id)) };
  },
});
