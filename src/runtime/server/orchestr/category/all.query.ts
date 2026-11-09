import { CategoryAllQuery } from '@laioutr-core/canonical-types/ecommerce';
import { collectionsToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { collectionsPage } from '../../services/catalog';

export default defineVendureQuery({
  implements: CategoryAllQuery,
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ context, pagination, passthrough }) => {
    const page = await collectionsPage(context.catalogClient, { skip: pagination.offset, take: pagination.limit });
    passthrough.set(collectionsToken, page.items);
    return { ids: page.items.map((collection) => collection.id), total: page.totalItems };
  },
});
