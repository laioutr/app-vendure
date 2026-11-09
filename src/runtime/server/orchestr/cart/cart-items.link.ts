import { CartItemsLink } from '@laioutr-core/canonical-types/ecommerce';
import { cartItemIds } from '../../mappers/order';
import { defineVendureLink } from '../../middleware/defineVendure';
import { activeOrderFor } from '../../utils/activeOrder';

export default defineVendureLink(CartItemsLink, async ({ entityIds, context, passthrough }) => {
  const order = await activeOrderFor(context.vendureClient, passthrough);

  return {
    links: entityIds.map((id) => {
      const targetIds = order?.id === id ? cartItemIds(order) : [];
      return { sourceId: id, targetIds, entityTotal: targetIds.length };
    }),
  };
});
