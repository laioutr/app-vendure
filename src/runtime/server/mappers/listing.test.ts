import { describe, expect, it } from 'vitest';
import { IN_STOCK_FILTER_ID, mapFacetsToFilters, mapFiltersToSearchInput, resolveSorting } from './listing';

const facetValue = (id: string, name: string, facetCode: string, facetName: string, count: number) => ({
  count,
  facetValue: { id, code: name.toLowerCase(), name, facet: { id: `f-${facetCode}`, code: facetCode, name: facetName } },
});

describe('mapFacetsToFilters', () => {
  const values = [facetValue('1', 'Apple', 'brand', 'Brand', 2), facetValue('2', 'Sony', 'brand', 'Brand', 3), facetValue('3', 'Red', 'colour', 'Colour', 1)];

  it('groups values by facet and adds the stock filter where the search filters on stock', () => {
    expect(mapFacetsToFilters(values, true)).toEqual([
      {
        type: 'list',
        id: 'brand',
        label: 'Brand',
        wellKnownName: 'brand',
        presentation: 'text',
        values: [
          { id: '1', label: 'Apple', count: 2 },
          { id: '2', label: 'Sony', count: 3 },
        ],
      },
      { type: 'list', id: 'colour', label: 'Colour', wellKnownName: 'color', presentation: 'text', values: [{ id: '3', label: 'Red', count: 1 }] },
      { type: 'boolean', id: IN_STOCK_FILTER_ID, label: 'In stock', wellKnownName: 'in-stock' },
    ]);
  });

  it('offers no stock filter where the search cannot filter on stock', () => {
    expect(mapFacetsToFilters(values, false).map((filter) => filter.id)).toEqual(['brand', 'colour']);
  });
});

describe('mapFiltersToSearchInput', () => {
  it('ORs values of one facet and ANDs facets', () => {
    expect(mapFiltersToSearchInput({ brand: ['1', '2'], colour: ['3'], [IN_STOCK_FILTER_ID]: true }, true)).toEqual({
      facetValueFilters: [{ or: ['1', '2'] }, { or: ['3'] }],
      inStock: true,
    });
  });

  it('never sends the stock filter to a search without it', () => {
    expect(mapFiltersToSearchInput({ brand: ['1'], [IN_STOCK_FILTER_ID]: true }, false)).toEqual({ facetValueFilters: [{ or: ['1'] }] });
  });

  it('drops what Vendure cannot filter on', () => {
    expect(mapFiltersToSearchInput({ price: { min: 1, max: 2 }, brand: [], [IN_STOCK_FILTER_ID]: false }, true)).toEqual({});
    expect(mapFiltersToSearchInput(undefined, true)).toEqual({});
  });
});

describe('resolveSorting', () => {
  it('defaults a term search to relevance and a collection to name', () => {
    expect(resolveSorting(undefined, true).key).toBe('relevance');
    expect(resolveSorting(undefined, false)).toMatchObject({ key: 'name-asc', sort: { name: 'ASC' } });
  });

  it('applies a known key and ignores an unknown one', () => {
    expect(resolveSorting('price-desc', false).sort).toEqual({ price: 'DESC' });
    expect(resolveSorting('relevance', false).key).toBe('name-asc');
    expect(resolveSorting('nope', true).key).toBe('relevance');
  });
});
