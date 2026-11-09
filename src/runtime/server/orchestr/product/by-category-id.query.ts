import { ProductsByCategoryIdQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { productListing } from '../../services/listing';

export default defineVendureQuery({
  implements: ProductsByCategoryIdQuery,
  cache: { ttl: '1 hour', swr: true, staleMaxAge: '1 day' },
  run: ({ context, input, pagination, sorting, filter }) =>
    productListing(context.catalogClient, { collectionId: input.categoryId }, { pagination, sorting, filter, searchesByStock: context.searchesByStock }),
});
