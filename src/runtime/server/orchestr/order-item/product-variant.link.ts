import { OrderItemProductVariantLink } from '@laioutr-core/canonical-types/ecommerce';
import { ordersToken, variantsToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';
import { variantEntriesOfLines } from '../../services/order';
import { linesOf } from '../../utils/orders';

/** No cache: the ProductVariant resolver reads the variants this link puts into the passthrough. */
export default defineVendureLink(OrderItemProductVariantLink, async ({ entityIds, context, passthrough }) => {
  const orders = passthrough.get(ordersToken) ?? [];
  const lines = linesOf(orders);
  const wanted = entityIds.flatMap((id) => (lines.has(id) ? [lines.get(id)!] : []));

  const entries = await variantEntriesOfLines(context.catalogClient, [...new Set(wanted.map(({ order }) => order))]);
  passthrough.set(variantsToken, [...(passthrough.get(variantsToken) ?? []), ...entries]);
  const known = new Set(entries.map((entry) => entry.variant.id));

  // A variant deleted since the order was placed has no link.
  return {
    links: wanted.flatMap(({ line }) =>
      known.has(line.productVariant.id) ? [{ sourceId: line.id, targetId: line.productVariant.id }] : []
    ),
  };
});
