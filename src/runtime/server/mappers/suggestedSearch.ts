import { mapImage } from './media';
import type { SuggestedEntry } from '../const/passthroughTokens';
import type { SearchItemFieldsFragment } from '../types/vendure.generated';

export const suggestedProductEntries = (items: readonly SearchItemFieldsFragment[]): SuggestedEntry[] =>
  items.map((item) => ({
    id: `product:${item.productId}`,
    type: 'product',
    title: item.productName,
    slug: item.slug,
    entityId: item.productId,
    preview: item.productAsset?.preview,
  }));

export const suggestedCategoryEntries = (collections: readonly { id: string; name: string; slug: string }[]): SuggestedEntry[] =>
  collections.map((collection) => ({ id: `category:${collection.id}`, type: 'category', title: collection.name, slug: collection.slug, entityId: collection.id }));

export const suggestedEntryBase = (entry: SuggestedEntry) => ({
  type: entry.type,
  title: entry.title,
  link: {
    type: 'reference' as const,
    reference: { type: entry.type === 'product' ? ('Product' as const) : ('Category' as const), slug: entry.slug ?? '', id: entry.entityId ?? '' },
  },
  cover: entry.preview ? mapImage({ preview: entry.preview }, entry.title) : undefined,
});
