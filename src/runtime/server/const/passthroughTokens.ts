import { createPassthroughToken } from '#imports';
import type { MenuEntry } from '../services/catalog';
import type { CollectionFieldsFragment, OrderFieldsFragment, ProductFieldsFragment, VariantFieldsFragment } from '../types/vendure.generated';
import type { PassthroughToken } from '@laioutr-core/orchestr/types';

// Each token is cast: `createPassthroughToken` comes from `#imports`, which the declaration builder
// cannot resolve, and without the cast every `passthrough.get()` downstream answers `{}`.

/** Full products fetched by a query or link, so the Product resolver does not fetch them again. */
export const productsToken = createPassthroughToken('@laioutr/app-vendure/products') as PassthroughToken<ProductFieldsFragment[]>;

/**
 * Variants with the product they belong to. The Shop API cannot read a variant by its id, so the
 * ProductVariant resolver has no source but this.
 */
export const variantsToken = createPassthroughToken('@laioutr/app-vendure/variants') as PassthroughToken<VariantEntry[]>;

export interface VariantEntry {
  variant: VariantFieldsFragment;
  product: Pick<ProductFieldsFragment, 'id' | 'name' | 'slug' | 'featuredAsset'>;
}

export const collectionsToken = createPassthroughToken('@laioutr/app-vendure/collections') as PassthroughToken<CollectionFieldsFragment[]>;

/** The menu tree, kept apart from collections: an entry carries no description, image or trail. */
export const menuToken = createPassthroughToken('@laioutr/app-vendure/menu') as PassthroughToken<MenuEntry[]>;

/** The visitor's active order — the cart — for the Cart and CartItem resolvers and their links. */
export const activeOrderToken = createPassthroughToken('@laioutr/app-vendure/active-order') as PassthroughToken<OrderFieldsFragment | null>;

/** Placed orders read by an order query, for the Order and OrderItem resolvers and their links. */
export const ordersToken = createPassthroughToken('@laioutr/app-vendure/orders') as PassthroughToken<OrderFieldsFragment[]>;

export interface SuggestedEntry {
  id: string;
  type: 'product' | 'category' | 'query-suggestion';
  title: string;
  slug?: string;
  entityId?: string;
  preview?: string;
}

export const suggestedEntriesToken = createPassthroughToken('@laioutr/app-vendure/suggested-entries') as PassthroughToken<SuggestedEntry[]>;
