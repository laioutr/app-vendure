import { fitCanonical } from '@laioutr-core/core-types/source-entity';
import type { VendureContext } from '../../middleware/vendureContext';
import type { JSONType } from '@laioutr-core/core-types/common';
import type { ConnectorSourceEntity, SourceEntityCanonical, SourceEntityComponents } from '@laioutr-core/core-types/source-entity';
import { categoryComponents } from '../../mappers/collection';
import { productComponents, variantComponents } from '../../mappers/product';
import { collectionsByIds, productsByIds } from '../../services/catalog';

/** The storefront entities of `ids` that the storefront shows; one it does not show is not in the answer. */
export type CanonicalRead = (context: VendureContext, ids: string[]) => Promise<Map<string, SourceEntityCanonical>>;

/**
 * Components as the JSON a source entity stores: each one given as a function called, what answers
 * `undefined` left out. A component that throws costs only itself.
 */
export const canonicalComponents = (components: Record<string, unknown>, where: string): SourceEntityComponents => {
  const stored: SourceEntityComponents = {};
  for (const [name, component] of Object.entries(components)) {
    try {
      const value: unknown = typeof component === 'function' ? (component as () => unknown)() : component;
      if (value !== undefined) stored[name] = JSON.parse(JSON.stringify(value)) as JSONType;
    } catch (error) {
      console.warn(`[vendure] ${where}: the ${name} component is left out of its storefront entity:`, error);
    }
  }
  return stored;
};

/** Products read through the Shop API, as the Product and ProductVariant resolvers answer them. */
export const canonicalProducts: CanonicalRead = async (context, ids) =>
  new Map(
    (await productsByIds(context.catalogClient, ids)).map((product) => [
      product.id,
      {
        components: canonicalComponents(productComponents(product, context.currencyCode), `product ${product.id}`),
        children: {
          ProductVariant: product.variants.map((variant) => ({
            id: variant.id,
            components: canonicalComponents(variantComponents(variant, product), `variant ${variant.id}`),
          })),
        },
      },
    ])
  );

/** Collections read through the Shop API, as the Category resolver answers them. */
export const canonicalCollections: CanonicalRead = async (context, ids) =>
  new Map(
    (await collectionsByIds(context.catalogClient, ids)).map((collection) => [
      collection.id,
      { components: canonicalComponents(categoryComponents(collection), `collection ${collection.id}`) },
    ])
  );

/**
 * A page of entities, each with its storefront entity, or null for one the storefront does not show.
 * A failed read leaves the page without them: the texts to translate are stored regardless, and a
 * later read fills them in.
 */
export const withCanonical = async (
  entities: ConnectorSourceEntity[],
  type: string,
  context: VendureContext,
  read: CanonicalRead
): Promise<ConnectorSourceEntity[]> => {
  if (entities.length === 0) return entities;
  try {
    const canonical = await read(
      context,
      entities.map((entity) => entity.id)
    );
    return entities.map((entity) => {
      const found = canonical.get(entity.id);
      return { ...entity, canonical: found ? fitCanonical(found) : null };
    });
  } catch (error) {
    console.warn(`[vendure] ${type}: the storefront entities of a page of ${entities.length} were not read; stored without them:`, error);
    return entities;
  }
};
