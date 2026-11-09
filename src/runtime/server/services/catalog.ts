import type { VendureClient } from '../client/VendureClient';
import type { CollectionFieldsFragment, ProductFieldsFragment, SearchInput } from '../types/vendure.generated';
import { operations } from '../client/operations';
import { MAX_PAGE_SIZE, ROOT_COLLECTION_SLUG } from '../const';
import { flattenCollectionTree } from '../mappers/collection';
import { inPages, knownOrFetched } from '../utils/batches';

export const productBySlug = async (client: VendureClient, slug: string) => (await client.request(operations.productBySlug, { slug })).product;

/** Products by id, in the order asked, one request per hundred; ids Vendure does not know are left out. */
export const productsByIds = async (client: VendureClient, ids: readonly string[]): Promise<ProductFieldsFragment[]> => {
  const pages = await inPages(ids, (batch) => client.request(operations.productsByIds, { ids: batch, take: batch.length }));
  const byId = new Map(pages.flatMap((page) => page.products.items).map((product) => [product.id, product]));
  return [...new Set(ids)].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
};

/** Product search, one product per result (`groupByProduct`), as every listing shows products. */
export const searchProducts = async (client: VendureClient, input: Omit<SearchInput, 'groupByProduct'>) =>
  (await client.request(operations.search, { input: { ...input, groupByProduct: true } })).search;

export const collectionBySlug = async (client: VendureClient, slug: string) =>
  (await client.request(operations.collectionBySlug, { slug })).collection;

export const collectionsByIds = async (client: VendureClient, ids: readonly string[]): Promise<CollectionFieldsFragment[]> =>
  (await inPages(ids, (batch) => client.request(operations.collections, { options: { filter: { id: { in: batch } }, take: batch.length } }))).flatMap(
    (page) => page.collections.items
  );

/** One page of collections, the whole tree when `topLevelOnly` is not set. */
export const collectionsPage = async (client: VendureClient, options: { skip: number; take: number; topLevelOnly?: boolean; term?: string }) => {
  const { collections } = await client.request(operations.collections, {
    options: {
      skip: options.skip,
      take: Math.min(options.take, MAX_PAGE_SIZE),
      topLevelOnly: options.topLevelOnly,
      sort: { position: 'ASC' },
      ...(options.term ? { filter: { name: { contains: options.term } } } : {}),
    },
  });
  return collections;
};

/**
 * Every collection of the channel. A shop's tree is small, but a page is capped at a hundred, so it
 * is read page by page.
 */
export const allCollections = async (client: VendureClient): Promise<CollectionFieldsFragment[]> => {
  const first = await collectionsPage(client, { skip: 0, take: MAX_PAGE_SIZE });
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(first.totalItems / MAX_PAGE_SIZE) - 1 }, (_, index) =>
      collectionsPage(client, { skip: (index + 1) * MAX_PAGE_SIZE, take: MAX_PAGE_SIZE })
    )
  );
  return [first, ...rest].flatMap((page) => page.items);
};

export type MenuEntry = ReturnType<typeof flattenCollectionTree>[number];

/** Aliases that name the whole tree rather than one collection's subtree. */
export const ROOT_MENU_ALIASES = new Set(['root', 'main', 'main-menu', ROOT_COLLECTION_SLUG]);

/**
 * The menu below a collection: every collection under the one `alias` names, as a flat tree. The
 * named collection is the menu's container, not one of its entries.
 */
export const menuBelow = async (client: VendureClient, alias: string): Promise<MenuEntry[] | undefined> => {
  const collections = await allCollections(client);
  const rootId = ROOT_MENU_ALIASES.has(alias)
    ? collections.find((collection) => collection.breadcrumbs.length === 2)?.parentId
    : collections.find((collection) => collection.slug === alias)?.id;
  if (!rootId) return undefined;
  return flattenCollectionTree(collections, rootId);
};

/** The products `ids` names, taking those a query already fetched (`known`) and reading the rest in one batch. */
export const productsKnownOrFetched = (client: VendureClient, known: readonly ProductFieldsFragment[] | undefined, ids: readonly string[]) =>
  knownOrFetched(known, ids, (missing) => productsByIds(client, missing));

/** The same for collections. */
export const collectionsKnownOrFetched = (client: VendureClient, known: readonly CollectionFieldsFragment[] | undefined, ids: readonly string[]) =>
  knownOrFetched(known, ids, (missing) => collectionsByIds(client, missing));

/** Collections a Studio picker offers for a typed term; the root collection is never offered. */
export const collectionChoices = async (client: VendureClient, term: string | undefined) =>
  (await collectionsPage(client, { skip: 0, take: 50, term: term || undefined })).items.filter(
    (collection) => collection.slug !== ROOT_COLLECTION_SLUG
  );
