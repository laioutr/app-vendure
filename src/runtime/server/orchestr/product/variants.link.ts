import { ProductVariantsLink } from '@laioutr-core/canonical-types/ecommerce';
import { productsToken, variantsToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';
import { productsKnownOrFetched } from '../../services/catalog';

/**
 * The ProductVariant resolver has no source but the passthrough this link fills — the Shop API reads
 * no variant by its id — so the link carries no cache: a hit would skip the run and leave the
 * variants unresolved.
 */
export default defineVendureLink({
  implements: ProductVariantsLink,
  run: async ({ entityIds, context, passthrough }) => {
    const known = await productsKnownOrFetched(context.catalogClient, passthrough.get(productsToken), entityIds);

    const products = entityIds.flatMap((id) => (known.has(id) ? [known.get(id)!] : []));
    passthrough.set(variantsToken, [
      ...(passthrough.get(variantsToken) ?? []),
      ...products.flatMap((product) => product.variants.map((variant) => ({ variant, product }))),
    ]);

    return {
      links: products.map((product) => ({
        sourceId: product.id,
        targetIds: product.variants.map((variant) => variant.id),
        entityTotal: product.variants.length,
      })),
    };
  },
});
