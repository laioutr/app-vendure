import { CartItemAvailability, CartItemBase, CartItemCost, CartItemQuantityRule } from '@laioutr-core/canonical-types/entity/cart-item';
import { cartCouponComponents, cartLineComponents, couponCodeOfItemId } from '../../mappers/order';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { activeOrderFor } from '../../utils/activeOrder';

export default defineVendureComponentResolver({
  entityType: 'CartItem',
  label: 'Vendure Cart Item Resolver',
  provides: [CartItemBase, CartItemCost, CartItemAvailability, CartItemQuantityRule],
  cache: false,
  resolve: async ({ entityIds, context, passthrough, $entity }) => {
    const order = await activeOrderFor(context.vendureClient, passthrough);
    if (!order) return { entities: [], notFound: entityIds };

    const lines = new Map(order.lines.map((line) => [line.id, line]));
    const entities = entityIds.flatMap((id) => {
      const coupon = couponCodeOfItemId(id);
      const line = lines.get(id);
      const isCoupon = !!coupon && order.couponCodes.includes(coupon);
      const components =
        isCoupon ? cartCouponComponents(coupon!, order.currencyCode) : line && cartLineComponents(line, order.currencyCode);
      if (!components) return [];
      return [
        $entity({
          id,
          base: () => components.base,
          cost: () => components.cost,
          availability: () => components.availability,
          quantityRule: () => components.quantityRule,
        }),
      ];
    });

    const found = new Set(entities.map((entity) => entity.id));
    return { entities, notFound: entityIds.filter((id) => !found.has(id)) };
  },
});
