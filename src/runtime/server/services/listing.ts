import { searchProducts } from './catalog';
import type { VendureClient } from '../client/VendureClient';
import type { SearchInput } from '../types/vendure.generated';
import type { QueryWireRequestFilter } from '@laioutr-core/orchestr/types';
import { MAX_PAGE_SIZE } from '../const';
import { mapFacetsToFilters, mapFiltersToSearchInput, resolveSorting } from '../mappers/listing';

export interface ListingArgs {
  pagination: { offset: number; limit: number };
  sorting?: string;
  filter?: QueryWireRequestFilter;
  /** Whether the server's search filters on stock; see `VendureChannel`. */
  searchesByStock: boolean;
}

/**
 * One page of products for a collection or a term, with its filters and sortings, as every product
 * listing answers. Products are resolved by id afterwards, in one batched read.
 */
export const productListing = async (
  client: VendureClient,
  scope: Pick<SearchInput, 'collectionId' | 'collectionSlug' | 'term'>,
  { pagination, sorting, filter, searchesByStock }: ListingArgs
) => {
  const term = scope.term?.trim() || undefined;
  const resolved = resolveSorting(sorting, !!term);

  const search = await searchProducts(client, {
    ...scope,
    term,
    ...mapFiltersToSearchInput(filter, searchesByStock),
    sort: resolved.sort,
    skip: pagination.offset,
    take: Math.min(pagination.limit, MAX_PAGE_SIZE),
  });

  return {
    ids: search.items.map((item) => item.productId),
    total: search.totalItems,
    availableFilters: mapFacetsToFilters(search.facetValues, searchesByStock),
    availableSortings: resolved.availableSortings,
    sorting: resolved.key,
  };
};
