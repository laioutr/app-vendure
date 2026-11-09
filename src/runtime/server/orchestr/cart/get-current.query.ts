import { GetCurrentCartQuery } from '@laioutr-core/canonical-types/ecommerce';
import { activeOrderToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { activeOrderOf } from '../../services/order';

// No cache: the cart belongs to one visitor.
export default defineVendureQuery(GetCurrentCartQuery, async ({ context, passthrough, notFound }) => {
  const order = await activeOrderOf(context.vendureClient);
  if (!order) return notFound();

  passthrough.set(activeOrderToken, order);
  return { id: order.id };
});
