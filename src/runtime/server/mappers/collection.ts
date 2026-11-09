import { mapImage } from './media';
import { plainTextOf } from './text';
import type { CollectionFieldsFragment } from '../types/vendure.generated';
import { ROOT_COLLECTION_SLUG } from '../const';

export interface Crumb {
  id: string;
  name: string;
  slug: string;
}

/** One step of a breadcrumb trail, linking to its category. */
export const categoryCrumb = (crumb: Crumb, isCurrentPage = false) => ({
  id: `breadcrumb:category:${crumb.id}`,
  base: {
    name: crumb.name,
    ...(isCurrentPage ? { isCurrentPage } : {}),
    link: { type: 'reference' as const, reference: { type: 'Category' as const, slug: crumb.slug, id: crumb.id } },
  },
});

/** A collection's trail from the top, without the hidden root collection. */
export const collectionTrail = (breadcrumbs: readonly Crumb[]): Crumb[] =>
  breadcrumbs.filter((crumb) => crumb.slug !== ROOT_COLLECTION_SLUG);

export const categoryComponents = (collection: CollectionFieldsFragment) => ({
  base: { slug: collection.slug, title: collection.name },
  media: { media: collection.featuredAsset ? [mapImage(collection.featuredAsset, collection.name)] : [] },
  content: { description: { html: collection.description } },
  seo: { title: collection.name, description: plainTextOf(collection.description) || undefined },
});

export interface CollectionNode {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  position: number;
}

/**
 * Every collection below `rootId`, depth first and in Vendure's position order, each with its
 * parent and children inside that subtree. The node `rootId` names is not part of it.
 */
export const flattenCollectionTree = (collections: readonly CollectionNode[], rootId: string) => {
  const childrenOf = new Map<string, CollectionNode[]>();
  for (const collection of collections) {
    const siblings = childrenOf.get(collection.parentId) ?? [];
    siblings.push(collection);
    childrenOf.set(collection.parentId, siblings);
  }
  for (const siblings of childrenOf.values()) siblings.sort((a, b) => a.position - b.position);

  const flat: (CollectionNode & { parentInTree?: string; childIds: string[] })[] = [];
  const visit = (parentId: string, seen: Set<string>) => {
    for (const child of childrenOf.get(parentId) ?? []) {
      // A cycle cannot come from Vendure's tree, but guarding costs nothing and keeps a bad answer finite.
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      flat.push({
        ...child,
        parentInTree: parentId === rootId ? undefined : parentId,
        childIds: (childrenOf.get(child.id) ?? []).map((grandchild) => grandchild.id),
      });
      visit(child.id, seen);
    }
  };
  visit(rootId, new Set());
  return flat;
};
