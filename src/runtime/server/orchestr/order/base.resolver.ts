import { OrderAddresses, OrderBase, OrderBuyer, OrderCost, OrderDeliveries, OrderPayments, OrderState } from '@laioutr-core/canonical-types/entity/order';
import { orderComponents } from '../../mappers/order';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { ordersFor } from '../../utils/orders';

export default defineVendureComponentResolver({
  entityType: 'Order',
  label: 'Vendure Order Resolver',
  provides: [OrderBase, OrderState, OrderCost, OrderAddresses, OrderDeliveries, OrderPayments, OrderBuyer],
  cache: false,
  resolve: async ({ entityIds, context, passthrough, $entity }) => {
    const orders = await ordersFor(context.vendureClient, passthrough, entityIds);

    const entities = entityIds.flatMap((id) => {
      const order = orders.get(id);
      if (!order) return [];
      const components = orderComponents(order);
      return [
        $entity({
          id,
          base: () => components.base,
          state: () => components.state,
          cost: () => components.cost,
          addresses: () => components.addresses,
          deliveries: () => components.deliveries,
          payments: () => components.payments,
          buyer: () => components.buyer,
        }),
      ];
    });

    return { entities, notFound: entityIds.filter((id) => !orders.has(id)) };
  },
});
