import { ProductBySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { productsToken } from '../../const/passthroughTokens';
import { defineVendureQuery } from '../../middleware/defineVendure';
import { productBySlug } from '../../services/catalog';

export default defineVendureQuery({
  implements: ProductBySlugQuery,
  cache: { ttl: '1 day', swr: true, staleMaxAge: '1 day' },
  run: async ({ context, input, passthrough, notFound }) => {
    const product = await productBySlug(context.catalogClient, input.slug);
    if (!product) return notFound();

    passthrough.set(productsToken, [product]);
    return { id: product.id };
  },
});
