import { ProductSearchQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { productListing } from '../../services/listing';

export default defineVendureQuery({
  implements: ProductSearchQuery,
  cache: { ttl: '10 minutes', swr: true, staleMaxAge: '1 hour' },
  run: ({ context, input, pagination, sorting, filter }) =>
    productListing(context.catalogClient, { term: input.query }, { pagination, sorting, filter, searchesByStock: context.searchesByStock }),
});
