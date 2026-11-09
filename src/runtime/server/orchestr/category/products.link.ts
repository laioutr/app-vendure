import { CategoryProductsLink } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureLink } from '../../middleware/defineVendure';
import { productListing } from '../../services/listing';

const DEFAULT_LIMIT = 48;

export default defineVendureLink({
  implements: CategoryProductsLink,
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: async ({ entityIds, context, pagination, sorting, filter }) => {
    const page = pagination ?? { offset: 0, limit: DEFAULT_LIMIT, page: 1 };
    const listings = await Promise.all(
      entityIds.map(async (collectionId) => ({
        collectionId,
        listing: await productListing(context.catalogClient, { collectionId }, { pagination: page, sorting, filter, searchesByStock: context.searchesByStock }),
      }))
    );

    return {
      links: listings.map(({ collectionId, listing }) => ({
        sourceId: collectionId,
        targetIds: listing.ids,
        entityTotal: listing.total,
        availableFilters: listing.availableFilters,
        availableSortings: listing.availableSortings,
      })),
    };
  },
});
