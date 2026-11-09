import { CategoryBreadcrumbLink } from '@laioutr-core/canonical-types/ecommerce';
import { BreadcrumbItemBase } from '@laioutr-core/canonical-types/entity/breadcrumb-item';
import { collectionsToken } from '../../const/passthroughTokens';
import { categoryCrumb, collectionTrail } from '../../mappers/collection';
import { defineVendureLink } from '../../middleware/defineVendure';
import { collectionsKnownOrFetched } from '../../services/catalog';

export default defineVendureLink({
  implements: CategoryBreadcrumbLink,
  provides: [BreadcrumbItemBase],
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ entityIds, context, passthrough, $entity }) => {
    const known = await collectionsKnownOrFetched(context.catalogClient, passthrough.get(collectionsToken), entityIds);

    return {
      links: entityIds.flatMap((id) => {
        const collection = known.get(id);
        if (!collection) return [];
        const trail = collectionTrail(collection.breadcrumbs);

        return [
          {
            sourceId: id,
            entities: trail.map((crumb, index) => {
              const step = categoryCrumb(crumb, index === trail.length - 1);
              return $entity({ id: step.id, base: () => step.base });
            }),
          },
        ];
      }),
    };
  },
});
