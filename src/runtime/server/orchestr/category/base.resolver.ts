import { CategoryBase, CategoryContent, CategoryMedia, CategorySeo } from '@laioutr-core/canonical-types/entity/category';
import { collectionsToken } from '../../const/passthroughTokens';
import { categoryComponents } from '../../mappers/collection';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { collectionsKnownOrFetched } from '../../services/catalog';

export default defineVendureComponentResolver({
  entityType: 'Category',
  label: 'Vendure Category Resolver',
  provides: [CategoryBase, CategoryContent, CategoryMedia, CategorySeo],
  cache: { ttl: '1 hour' },
  resolve: async ({ entityIds, context, passthrough, $entity }) => {
    const known = await collectionsKnownOrFetched(context.catalogClient, passthrough.get(collectionsToken), entityIds);

    const entities = entityIds.flatMap((id) => {
      const collection = known.get(id);
      if (!collection) return [];
      const components = categoryComponents(collection);
      return [
        $entity({
          id,
          base: () => components.base,
          media: () => components.media,
          content: () => components.content,
          seo: () => components.seo,
        }),
      ];
    });

    return { entities, notFound: entityIds.filter((id) => !known.has(id)) };
  },
});
