import { paginate } from '#imports';
import { ProductListingPage } from '@laioutr-core/canonical-types/ecommerce';
import { MAX_PAGE_SIZE } from '../../const';
import { collectionPageEntry, offsetOfCursor } from '../../mappers/pageIndex';
import { defineVendurePageIndex } from '../../middleware/defineVendure';
import { collectionBySlug, collectionsPage } from '../../services/catalog';

export default defineVendurePageIndex({
  for: ProductListingPage,
  label: 'Vendure Collection',
  batchSize: MAX_PAGE_SIZE,
  cache: { ttl: '1h', search: { ttl: '5m' }, locate: { ttl: '1 day' } },
  // `locales` is left out, for the same reason as the product page index.
  locate: async ({ context, params }) => {
    const collection = params.slug ? await collectionBySlug(context.catalogClient, params.slug) : undefined;
    if (!collection) return undefined;
    const { subject, meta } = collectionPageEntry(collection);
    return { subject, meta };
  },
  count: async ({ context }) => (await collectionsPage(context.catalogClient, { skip: 0, take: 1 })).totalItems,
  search: async ({ context, term, take }) =>
    (await collectionsPage(context.catalogClient, { skip: 0, take, term: term || undefined })).items.map(collectionPageEntry),
  list: ({ context, batchSize, startCursor }) =>
    paginate(async ({ cursor }) => {
      const skip = offsetOfCursor(cursor);
      const page = await collectionsPage(context.catalogClient, { skip, take: batchSize });
      const next = skip + page.items.length;
      return {
        entries: page.items.map(collectionPageEntry),
        nextCursor: page.items.length && next < page.totalItems ? String(next) : undefined,
      };
    }, startCursor),
});
