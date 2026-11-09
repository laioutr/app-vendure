import { ChildCategoriesLink } from '@laioutr-core/canonical-types/ecommerce';
import { collectionsToken } from '../../const/passthroughTokens';
import { defineVendureLink } from '../../middleware/defineVendure';
import { collectionsKnownOrFetched } from '../../services/catalog';

/** Vendure's collections are a real tree, so a category's children are its child collections. */
export default defineVendureLink({
  implements: ChildCategoriesLink,
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ entityIds, context, passthrough }) => {
    const known = await collectionsKnownOrFetched(context.catalogClient, passthrough.get(collectionsToken), entityIds);

    return {
      links: entityIds.flatMap((id) => {
        const collection = known.get(id);
        if (!collection) return [];
        const children = [...(collection.children ?? [])].sort((a, b) => a.position - b.position);
        return [{ sourceId: id, targetIds: children.map((child) => child.id), entityTotal: children.length }];
      }),
    };
  },
});
