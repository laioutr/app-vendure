import { ProductAllCategoriesLink } from '@laioutr-core/canonical-types/ecommerce';
import { ROOT_COLLECTION_SLUG } from '../../const';
import { productsToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';
import { productsKnownOrFetched } from '../../services/catalog';

export default defineVendureLink({
  implements: ProductAllCategoriesLink,
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ entityIds, context, passthrough }) => {
    const known = await productsKnownOrFetched(context.catalogClient, passthrough.get(productsToken), entityIds);

    return {
      links: entityIds.flatMap((id) => {
        const product = known.get(id);
        if (!product) return [];
        const targetIds = product.collections.filter((collection) => collection.slug !== ROOT_COLLECTION_SLUG).map((collection) => collection.id);
        return [{ sourceId: id, targetIds, entityTotal: targetIds.length }];
      }),
    };
  },
});
