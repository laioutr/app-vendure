import { describe, expect, it } from 'vitest';
import {
  deepestCollectionOf,
  defaultVariantOf,
  productBrand,
  productComponents,
  productDefaultVariant,
  productFlags,
  productMedia,
  productOptionGroups,
  productPrices,
  shortDescriptionOf,
  variantAvailability,
  variantComponents,
  variantOptions,
  wellKnownOptionName,
} from './product';
import { asset, product, variant } from '../../../../test/fixtures/vendure';

describe('variantAvailability', () => {
  it('reads the stock levels of the default display strategy', () => {
    expect(variantAvailability('IN_STOCK')).toEqual({ status: 'inStock', quantity: 0 });
    expect(variantAvailability('LOW_STOCK')).toEqual({ status: 'inStock', quantity: 0 });
    expect(variantAvailability('OUT_OF_STOCK')).toEqual({ status: 'outOfStock', quantity: 0 });
  });

  it('reads a count from a custom display strategy', () => {
    expect(variantAvailability('7')).toEqual({ status: 'inStock', quantity: 7 });
    expect(variantAvailability('0')).toEqual({ status: 'outOfStock', quantity: 0 });
  });
});

describe('product', () => {
  it('defaults to the first variant in stock', () => {
    expect(defaultVariantOf(product())?.id).toBe('v2');
    expect(productDefaultVariant(product())).toEqual({
      origin: 'derived',
      id: 'v2',
      sku: 'L-15-8',
      options: ['15 inch', '8GB'],
      status: 'inStock',
    });
  });

  it('prices from the cheapest variant with tax, starting from when they differ', () => {
    expect(productPrices(product(), 'USD')).toEqual({
      price: { amount: 1190, currency: 'EUR' },
      taxIncluded: true,
      isOnSale: false,
      isStartingFrom: true,
    });
    expect(productPrices(product({ variants: [variant()] }), 'USD').isStartingFrom).toBe(false);
  });

  it('leads the gallery with the featured asset and leaves binary files out', () => {
    const { media, images } = productMedia(product());
    // Equal, never the same objects: a shared object would go over the wire as a back-reference.
    expect(images.every((image) => !media.includes(image))).toBe(true);
    expect(media.map((item) => (item.sources[0] as { src: string }).src)).toHaveLength(2);
    expect(images).toHaveLength(2);
    expect(productMedia(product({ featuredAsset: asset({ id: 'a1', preview: 'first' }) })).images[0]!.sources[0]!.src).toBe('first');
  });

  it('offers each option value with the variant that keeps the other selected options', () => {
    const { groups } = productOptionGroups(product());
    expect(groups[0]).toEqual({
      name: 'screen size',
      wellKnownName: 'size',
      values: [
        // 13 inch with the default's 8GB is v1, sold out.
        { value: '13 inch', variantId: 'v1', available: false },
        { value: '15 inch', variantId: 'v2', available: true },
      ],
    });
    expect(groups[1]!.values).toEqual([
      { value: '8GB', variantId: 'v2', available: true },
      { value: '16GB', variantId: 'v3', available: true },
    ]);
  });

  it("names well-known option groups by code, name or the code's last word", () => {
    expect(wellKnownOptionName({ code: 'shirt-colour', name: 'Shade' })).toBe('color');
    expect(wellKnownOptionName({ code: 'x', name: 'Size' })).toBe('size');
    expect(wellKnownOptionName({ code: 'laptop-ram', name: 'RAM' })).toBeUndefined();
  });

  it('reads the brand from a brand facet', () => {
    expect(productBrand(product())).toBe('Apple');
    expect(productBrand(product({ facetValues: [] }))).toBeUndefined();
  });

  it('flags only the values of a badge facet, naming the well-known ones', () => {
    expect(productFlags(product())).toEqual({ flags: [] });
    const flagged = product({
      facetValues: [
        { id: 'f1', code: 'apple', name: 'Apple', facet: { id: 'fb', code: 'brand', name: 'Brand' } },
        { id: 'f2', code: 'new', name: 'Neu', facet: { id: 'ff', code: 'flags', name: 'Flags' } },
        { id: 'f3', code: 'eco', name: 'Eco', facet: { id: 'ff', code: 'Flags', name: 'Flags' } },
      ],
    });
    expect(productFlags(flagged)).toEqual({
      flags: [
        { name: 'Neu', wellKnownName: 'new' },
        { name: 'Eco', wellKnownName: undefined },
      ],
    });
  });

  it('picks the deepest collection for the trail', () => {
    expect(deepestCollectionOf(product())?.slug).toBe('computers');
  });

  it('shortens HTML to text at a word', () => {
    expect(shortDescriptionOf('<p>A <b>fast</b> laptop &amp; more.</p>')).toBe('A fast laptop & more.');
    expect(shortDescriptionOf('one two three four', 9)).toBe('one two…');
    expect(shortDescriptionOf('<p></p>')).toBeUndefined();
  });

  it("lists a variant's options with their group names", () => {
    expect(variantOptions(variant())).toEqual([
      { name: 'screen size', value: '13 inch', wellKnownName: 'size' },
      { name: 'RAM', value: '8GB', wellKnownName: undefined },
    ]);
  });
});

describe('productComponents and variantComponents', () => {
  it('answers the brand facet as the brand component, and nothing as no brand', () => {
    expect(productComponents(product(), 'USD').brand()).toEqual({ name: 'Apple' });
    expect(productComponents(product({ facetValues: [] }), 'USD').brand()).toEqual({ name: undefined });
  });

  it("gives a variant without an image of its own the product's", () => {
    const own = productComponents(product(), 'USD');
    expect(own.base()).toEqual({ name: product().name, slug: product().slug });
    const bare = variant({ featuredAsset: null });
    expect(variantComponents(bare, { featuredAsset: asset() }).info().image?.sources[0]?.src).toBe(asset().preview);
  });
});
