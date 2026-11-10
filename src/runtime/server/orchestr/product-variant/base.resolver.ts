import {
  ProductVariantAvailability,
  ProductVariantBase,
  ProductVariantInfo,
  ProductVariantOptions,
  ProductVariantPrices,
  ProductVariantQuantityPrices,
  ProductVariantQuantityRule,
  ProductVariantShipping,
} from '@laioutr-core/canonical-types/entity/product-variant';
import { variantsToken } from '../../const/passthroughTokens';
import { variantComponents } from '../../mappers/product';
import { defineVendureComponentResolver } from '../../middleware/defineVendure';

/**
 * Variants are resolved from what the link that named them read — the product's variants, a cart's
 * or an order's lines — since the Shop API reads no variant by its id.
 */
export default defineVendureComponentResolver({
  entityType: 'ProductVariant',
  label: 'Vendure Product Variant Resolver',
  provides: [
    ProductVariantBase,
    ProductVariantInfo,
    ProductVariantAvailability,
    ProductVariantPrices,
    ProductVariantOptions,
    ProductVariantQuantityRule,
    ProductVariantQuantityPrices,
    ProductVariantShipping,
  ],
  cache: false,
  resolve: ({ entityIds, passthrough, $entity }) => {
    const byId = new Map((passthrough.get(variantsToken) ?? []).map((entry) => [entry.variant.id, entry]));

    const entities = entityIds.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [$entity({ id, ...variantComponents(entry.variant, entry.product) })] : [];
    });

    return { entities, notFound: entityIds.filter((id) => !byId.has(id)) };
  },
});
