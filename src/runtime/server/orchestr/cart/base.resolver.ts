import { CartBase, CartCost } from '@laioutr-core/canonical-types/entity/cart';
import { cartComponents } from '../../mappers/order';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { activeOrderFor } from '../../utils/activeOrder';

export default defineVendureComponentResolver({
  entityType: 'Cart',
  label: 'Vendure Cart Resolver',
  provides: [CartBase, CartCost],
  cache: false,
  resolve: async ({ entityIds, context, passthrough, $entity }) => {
    const order = await activeOrderFor(context.vendureClient, passthrough);
    // Only the visitor's own active order is a cart this resolver answers for.
    const found = order && entityIds.includes(order.id) ? order : undefined;
    if (!found) return { entities: [], notFound: entityIds };

    const components = cartComponents(found);
    return {
      entities: [$entity({ id: found.id, base: () => components.base, cost: () => components.cost })],
      notFound: entityIds.filter((id) => id !== found.id),
    };
  },
});
