import { describe, expect, it, vi } from 'vitest';
import { SHOP_API_URL, visitor } from './client';
import { channelOf } from '../../src/runtime/server/client/channel';
import { categoryComponents } from '../../src/runtime/server/mappers/collection';
import { productOptionGroups, productPrices } from '../../src/runtime/server/mappers/product';
import { vendureContext } from '../../src/runtime/server/middleware/vendureContext';
import { collectionBySlug, menuBelow, productBySlug, productsByIds, searchProducts } from '../../src/runtime/server/services/catalog';
import { productListing } from '../../src/runtime/server/services/listing';
import { productPageEntriesPage } from '../../src/runtime/server/services/pageIndex';

describe('catalog against the Shop API', () => {
  it('reads the channel the settings select, and whether its search filters on stock', async () => {
    const { channel, searchesByStock } = await channelOf(SHOP_API_URL, undefined);
    expect(channel.code).toBeTruthy();
    expect(channel.availableCurrencyCodes.length).toBeGreaterThan(0);
    expect(typeof searchesByStock).toBe('boolean');
  });

  it('reads a product by slug and again by id', async () => {
    const client = visitor().client();
    const product = await productBySlug(client, 'laptop');
    expect(product?.variants.length).toBeGreaterThan(1);
    expect(productPrices(product!, 'USD').price.amount).toBeGreaterThan(0);
    expect(productOptionGroups(product!).groups[0]!.values.every((value) => value.variantId)).toBe(true);

    const [again] = await productsByIds(client, [product!.id, 'does-not-exist']);
    expect(again?.slug).toBe('laptop');
  });

  it('answers in the language and currency asked, among those the channel offers', async () => {
    const { channel } = await channelOf(SHOP_API_URL, undefined);
    const currency = channel.availableCurrencyCodes.at(-1)!;
    const language = channel.availableLanguageCodes?.at(-1) ?? channel.defaultLanguageCode;
    const context = await vendureContext(
      { shopApiUrl: SHOP_API_URL },
      { market: { slug: 'contract', currency }, localeChain: [language], onSessionToken: () => {} }
    );
    const product = await productBySlug(context.catalogClient, 'laptop');
    expect(product?.variants[0]?.currencyCode).toBe(currency);
  });

  it("falls back to the channel's defaults for a currency and language it does not offer", async () => {
    const { channel } = await channelOf(SHOP_API_URL, undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = await vendureContext(
      { shopApiUrl: SHOP_API_URL },
      { market: { slug: 'contract-elsewhere', currency: 'XTS' }, localeChain: ['tlh-001'], onSessionToken: () => {} }
    );
    const product = await productBySlug(context.catalogClient, 'laptop');
    expect(product?.variants[0]?.currencyCode).toBe(channel.defaultCurrencyCode);
    expect(context.currencyCode).toBe(channel.defaultCurrencyCode);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"XTS"'));
    warn.mockRestore();
  });

  it('lists a collection with facets, filters and sorting', async () => {
    const client = visitor().client();
    const { searchesByStock } = await channelOf(SHOP_API_URL, undefined);
    const all = await productListing(
      client,
      { collectionSlug: 'electronics' },
      { pagination: { offset: 0, limit: 5 }, sorting: 'price-asc', searchesByStock }
    );
    expect(all.availableFilters.some((filter) => filter.id === 'in-stock')).toBe(searchesByStock);
    expect(all.ids.length).toBe(5);
    expect(all.total).toBeGreaterThan(5);
    const list = all.availableFilters.find((filter) => filter.type === 'list');
    expect(list).toBeDefined();

    const valueId = list!.type === 'list' ? list!.values[0]!.id : '';
    const filtered = await productListing(
      client,
      { collectionSlug: 'electronics' },
      { pagination: { offset: 0, limit: 50 }, filter: { [list!.id]: [valueId], 'in-stock': true }, searchesByStock }
    );
    expect(filtered.total).toBeLessThanOrEqual(all.total);
    expect(filtered.total).toBeGreaterThan(0);
  });

  it('lists without the stock filter on a search that cannot filter on stock', async () => {
    const listing = await productListing(
      visitor().client(),
      { term: 'camera' },
      { pagination: { offset: 0, limit: 3 }, filter: { 'in-stock': true }, searchesByStock: false }
    );
    expect(listing.total).toBeGreaterThan(0);
    expect(listing.availableFilters.some((filter) => filter.id === 'in-stock')).toBe(false);
  });

  it('searches by term', async () => {
    const search = await searchProducts(visitor().client(), { term: 'camera', take: 3 });
    expect(search.totalItems).toBeGreaterThan(0);
    expect(search.facetValues.length).toBeGreaterThan(0);
  });

  it('builds the menu from the collection tree', async () => {
    const client = visitor().client();
    const menu = await menuBelow(client, 'root');
    expect(menu?.length).toBeGreaterThan(0);
    expect(menu!.some((entry) => entry.childIds.length > 0)).toBe(true);

    const electronics = await collectionBySlug(client, 'electronics');
    expect(categoryComponents(electronics!).base.slug).toBe('electronics');
    expect(await menuBelow(client, 'electronics')).toEqual(expect.arrayContaining([expect.objectContaining({ parentInTree: undefined })]));
  });

  it('pages product entries for the page index', async () => {
    const page = await productPageEntriesPage(visitor().client(), { skip: 0, take: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.totalItems).toBeGreaterThan(2);
  });
});
