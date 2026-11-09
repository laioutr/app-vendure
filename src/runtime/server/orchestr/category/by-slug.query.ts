import { CategoryBySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { collectionsToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { collectionBySlug } from '../../services/catalog';

export default defineVendureQuery({
  implements: CategoryBySlugQuery,
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ context, input, passthrough, notFound }) => {
    const collection = await collectionBySlug(context.catalogClient, input.slug);
    if (!collection) return notFound();

    passthrough.set(collectionsToken, [collection]);
    return { id: collection.id };
  },
});
