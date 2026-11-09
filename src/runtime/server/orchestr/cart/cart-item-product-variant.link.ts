import { CartItemProductVariantLink } from '@laioutr-core/canonical-types/ecommerce';
import { variantsToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';
import { variantEntriesOfLines } from '../../services/order';
import { activeOrderFor } from '../../utils/activeOrder';

/** No cache: the ProductVariant resolver reads the variants this link puts into the passthrough. */
export default defineVendureLink(CartItemProductVariantLink, async ({ entityIds, context, passthrough }) => {
  const order = await activeOrderFor(context.vendureClient, passthrough);
  if (!order) return { links: [] };

  passthrough.set(variantsToken, [...(passthrough.get(variantsToken) ?? []), ...(await variantEntriesOfLines(context.catalogClient, [order]))]);
  const lines = new Map(order.lines.map((line) => [line.id, line]));

  return {
    links: entityIds.flatMap((id) => {
      const line = lines.get(id);
      return line ? [{ sourceId: id, targetId: line.productVariant.id }] : [];
    }),
  };
});
