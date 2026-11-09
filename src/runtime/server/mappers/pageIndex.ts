import { shortDescriptionOf } from './product';

/** Page index entries for products and collections, in the shape a sitemap and the link picker read. */
export const productPageEntry = (product: { id: string; name: string; slug: string; description: string; featuredAsset: { preview: string } | null }) => ({
  params: { slug: product.slug },
  subject: { type: 'Product' as const, id: product.id },
  meta: { title: product.name, description: shortDescriptionOf(product.description, 160), previewImage: product.featuredAsset?.preview },
});

export const collectionPageEntry = (collection: { id: string; name: string; slug: string; description: string; featuredAsset: { preview: string } | null }) => ({
  params: { slug: collection.slug },
  subject: { type: 'Category' as const, id: collection.id },
  meta: { title: collection.name, description: shortDescriptionOf(collection.description, 160), previewImage: collection.featuredAsset?.preview },
});

/** Skip-based pages behind the page index's opaque cursor. */
export const offsetOfCursor = (cursor: string | undefined) => {
  const offset = Number(cursor);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
};
