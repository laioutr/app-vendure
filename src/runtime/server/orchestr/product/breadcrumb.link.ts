import { ProductBreadcrumbLink } from '@laioutr-core/canonical-types/ecommerce';
import { BreadcrumbItemBase } from '@laioutr-core/canonical-types/entity/breadcrumb-item';
import { productsToken } from '../../const/passthroughTokens';
import { categoryCrumb, collectionTrail } from '../../mappers/collection';
import { deepestCollectionOf } from '../../mappers/product';
import { defineVendureLink } from '../../middleware/defineVendure';
import { productsKnownOrFetched } from '../../services/catalog';

export default defineVendureLink({
  implements: ProductBreadcrumbLink,
  provides: [BreadcrumbItemBase],
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ entityIds, context, passthrough, $entity }) => {
    const known = await productsKnownOrFetched(context.catalogClient, passthrough.get(productsToken), entityIds);

    return {
      links: entityIds.flatMap((id) => {
        const product = known.get(id);
        if (!product) return [];
        const trail = collectionTrail(deepestCollectionOf(product)?.breadcrumbs ?? []);

        return [
          {
            sourceId: id,
            entities: [
              ...trail.map((crumb) => {
                const step = categoryCrumb(crumb);
                return $entity({ id: step.id, base: () => step.base });
              }),
              $entity({
                id: `breadcrumb:product:${product.id}`,
                base: () => ({
                  name: product.name,
                  isCurrentPage: true,
                  link: { type: 'reference' as const, reference: { type: 'Product' as const, slug: product.slug, id: product.id } },
                }),
              }),
            ],
          },
        ];
      }),
    };
  },
});
