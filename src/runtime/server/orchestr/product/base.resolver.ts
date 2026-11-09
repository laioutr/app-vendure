import {
  ProductBase,
  ProductBrand,
  ProductDefaultVariant,
  ProductDescription,
  ProductFlags,
  ProductInfo,
  ProductMedia,
  ProductOptionGroups,
  ProductPrices,
  ProductSeo,
} from '@laioutr-core/canonical-types/entity/product';
import { productsToken } from '../../const/passthroughTokens';
import { productComponents } from '../../mappers/product';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';
import { productsKnownOrFetched } from '../../services/catalog';

export default defineVendureComponentResolver({
  entityType: 'Product',
  label: 'Vendure Product Resolver',
  provides: [
    ProductBase,
    ProductBrand,
    ProductDefaultVariant,
    ProductDescription,
    ProductInfo,
    ProductMedia,
    ProductOptionGroups,
    ProductPrices,
    ProductSeo,
    ProductFlags,
  ],
  cache: {
    ttl: '1 day',
    components: {
      prices: { ttl: '15 minutes' },
      defaultVariant: { ttl: '15 minutes' },
      optionGroups: { ttl: '15 minutes' },
    },
  },
  resolve: async ({ entityIds, context, passthrough, $entity }) => {
    const known = await productsKnownOrFetched(context.catalogClient, passthrough.get(productsToken), entityIds);

    const entities = entityIds.flatMap((id) => {
      const product = known.get(id);
      return product ? [$entity({ id, ...productComponents(product, context.currencyCode) })] : [];
    });

    return { entities, notFound: entityIds.filter((id) => !known.has(id)) };
  },
});
