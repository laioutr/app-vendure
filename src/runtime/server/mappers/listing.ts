import type { SearchInput, SearchQuery } from '../types/vendure.generated';
import type { AvailableFilter, AvailableSorting, QueryWireRequestFilter, WellKnownFilterName } from '@laioutr-core/orchestr/types';

/**
 * The filter id of the stock filter. Vendure's default search filters on stock with `inStock` only
 * when it indexes stock (`indexStockStatus`); elsewhere the field does not exist.
 */
export const IN_STOCK_FILTER_ID = 'in-stock';

const WELL_KNOWN_FACETS: Record<string, WellKnownFilterName> = {
  brand: 'brand',
  manufacturer: 'brand',
  category: 'category',
  color: 'color',
  colour: 'color',
  size: 'size',
  material: 'material',
  style: 'style',
  pattern: 'pattern',
  type: 'type',
};

type FacetValueResult = SearchQuery['search']['facetValues'][number];

/**
 * Search facet values grouped by their facet into list filters. A filter's id is the facet's code
 * and a value's id the facet value's id — what `facetValueFilters` takes back. The stock filter is
 * offered only where the server's search can filter on stock.
 */
export const mapFacetsToFilters = (facetValues: readonly FacetValueResult[], searchesByStock: boolean): AvailableFilter[] => {
  const byFacet = new Map<string, { label: string; values: { id: string; label: string; count: number }[] }>();
  for (const { count, facetValue } of facetValues) {
    const facet = byFacet.get(facetValue.facet.code) ?? { label: facetValue.facet.name, values: [] };
    facet.values.push({ id: facetValue.id, label: facetValue.name, count });
    byFacet.set(facetValue.facet.code, facet);
  }

  return [
    ...[...byFacet].map(
      ([code, facet]): AvailableFilter => ({
        type: 'list',
        id: code,
        label: facet.label,
        wellKnownName: WELL_KNOWN_FACETS[code.toLowerCase()],
        presentation: 'text',
        values: facet.values,
      })
    ),
    ...(searchesByStock ? [{ type: 'boolean', id: IN_STOCK_FILTER_ID, label: 'In stock', wellKnownName: 'in-stock' } satisfies AvailableFilter] : []),
  ];
};

/**
 * A storefront's filter selection as Vendure search input: values of one facet are alternatives
 * (`or`), different facets narrow each other. Anything Vendure cannot filter on is dropped.
 */
export const mapFiltersToSearchInput = (
  filter: QueryWireRequestFilter | undefined,
  searchesByStock: boolean
): Pick<SearchInput, 'facetValueFilters' | 'inStock'> => {
  const facetValueFilters: NonNullable<SearchInput['facetValueFilters']> = [];
  let inStock: boolean | undefined;

  for (const [id, value] of Object.entries(filter ?? {})) {
    if (id === IN_STOCK_FILTER_ID) {
      if (value === true && searchesByStock) inStock = true;
      continue;
    }
    if (Array.isArray(value) && value.length > 0) facetValueFilters.push({ or: value });
  }

  return { ...(facetValueFilters.length ? { facetValueFilters } : {}), ...(inStock ? { inStock } : {}) };
};

const SORTINGS = {
  relevance: { label: 'Relevance', sort: undefined },
  'name-asc': { label: 'Name (A–Z)', sort: { name: 'ASC' } },
  'name-desc': { label: 'Name (Z–A)', sort: { name: 'DESC' } },
  'price-asc': { label: 'Price (low to high)', sort: { price: 'ASC' } },
  'price-desc': { label: 'Price (high to low)', sort: { price: 'DESC' } },
} as const satisfies Record<string, { label: string; sort: SearchInput['sort'] }>;

type SortingKey = keyof typeof SORTINGS;

/**
 * The sortings of a listing and the one applied. A term search defaults to relevance; a collection
 * listing has no relevance, so it defaults to name.
 */
export const resolveSorting = (requested: string | undefined, hasTerm: boolean) => {
  const keys = (Object.keys(SORTINGS) as SortingKey[]).filter((key) => hasTerm || key !== 'relevance');
  const key: SortingKey = requested && (keys as string[]).includes(requested) ? (requested as SortingKey) : keys[0]!;
  const availableSortings: AvailableSorting[] = keys.map((candidate) => ({ key: candidate, label: SORTINGS[candidate].label }));
  return { key, sort: SORTINGS[key].sort as SearchInput['sort'], availableSortings };
};
