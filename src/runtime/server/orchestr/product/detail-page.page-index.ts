import { paginate } from '#imports';
import { ProductDetailPage } from '@laioutr-core/canonical-types/ecommerce';
import { MAX_PAGE_SIZE } from '../../const';
import { offsetOfCursor, productPageEntry } from '../../mappers/pageIndex';
import { defineVendurePageIndex } from '../../middleware/defineVendure';
import { productBySlug } from '../../services/catalog';
import { productPageEntriesPage } from '../../services/pageIndex';

export default defineVendurePageIndex({
  for: ProductDetailPage,
  label: 'Vendure Product',
  batchSize: MAX_PAGE_SIZE,
  cache: { ttl: '1h', search: { ttl: '5m' }, locate: { ttl: '1 day' } },
  // `locales` is left out: a slug per language needs one request per language, and naming only the
  // current one would claim the product has no page in the others.
  locate: async ({ context, params }) => {
    const product = params.slug ? await productBySlug(context.catalogClient, params.slug) : undefined;
    if (!product) return undefined;
    const { subject, meta } = productPageEntry(product);
    return { subject, meta };
  },
  count: async ({ context }) => (await productPageEntriesPage(context.catalogClient, { skip: 0, take: 1 })).totalItems,
  search: async ({ context, term, take }) =>
    (await productPageEntriesPage(context.catalogClient, { skip: 0, take, term: term || undefined })).items.map(productPageEntry),
  list: ({ context, batchSize, startCursor }) =>
    paginate(async ({ cursor }) => {
      const skip = offsetOfCursor(cursor);
      const page = await productPageEntriesPage(context.catalogClient, { skip, take: batchSize });
      const next = skip + page.items.length;
      return {
        entries: page.items.map(productPageEntry),
        nextCursor: page.items.length && next < page.totalItems ? String(next) : undefined,
      };
    }, startCursor),
});
