import { SuggestedSearchSearchQuery } from '@laioutr-core/canonical-types/suggested-search';
import { suggestedEntriesToken } from '../../const/passthroughTokens';
import { suggestedCategoryEntries, suggestedProductEntries } from '../../mappers/suggestedSearch';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { collectionChoices, searchProducts } from '../../services/catalog';

const PRODUCT_SUGGESTIONS = 6;
const CATEGORY_SUGGESTIONS = 4;

/** Vendure has no predictive search; a short product search and a collection name match stand in. */
export default defineVendureQuery({
  implements: SuggestedSearchSearchQuery,
  cache: { ttl: '10 minutes', includePassthrough: true },
  run: async ({ context, input, passthrough }) => {
    const term = input.query?.trim() ?? '';
    const id = `suggested-search:${term}`;
    if (!term) {
      passthrough.set(suggestedEntriesToken, []);
      return { id };
    }

    const [search, collections] = await Promise.all([
      searchProducts(context.catalogClient, { term, take: PRODUCT_SUGGESTIONS }),
      collectionChoices(context.catalogClient, term),
    ]);
    passthrough.set(suggestedEntriesToken, [
      ...suggestedCategoryEntries(collections.slice(0, CATEGORY_SUGGESTIONS)),
      ...suggestedProductEntries(search.items),
    ]);
    return { id };
  },
});
