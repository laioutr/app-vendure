import { mapAssets, mapImage } from './media';
import { money } from './money';
import { plainTextOf } from './text';
import { WELL_KNOWN_PRODUCT_FLAGS } from '@laioutr-core/canonical-types/entity/product';
import type { AssetFieldsFragment, ProductFieldsFragment, VariantFieldsFragment } from '../types/vendure.generated';
import type { MediaImage } from '@laioutr-core/core-types/common';
import { BRAND_FACET_CODE } from '../const';

type Variant = VariantFieldsFragment;
type Product = ProductFieldsFragment;

export type AvailabilityStatus = 'inStock' | 'outOfStock';

const WELL_KNOWN_OPTION_NAMES: Record<string, 'color' | 'size' | 'material' | 'style' | 'type'> = {
  color: 'color',
  colour: 'color',
  farbe: 'color',
  size: 'size',
  groesse: 'size',
  größe: 'size',
  material: 'material',
  style: 'style',
  type: 'type',
};

/**
 * The well-known name of an option group, from its code or name. Vendure's codes are often prefixed
 * by the product (`laptop-screen-size`), so the last word counts too.
 */
export const wellKnownOptionName = (group: { code: string; name: string }) => {
  for (const candidate of [group.code, group.name, group.code.split('-').at(-1) ?? '']) {
    const known = WELL_KNOWN_OPTION_NAMES[candidate.trim().toLowerCase()];
    if (known) return known;
  }
  return undefined;
};

/**
 * Vendure's default stock display answers `IN_STOCK`, `LOW_STOCK` or `OUT_OF_STOCK`; a custom
 * `StockDisplayStrategy` may answer the count instead.
 */
export const variantAvailability = (stockLevel: string): { status: AvailabilityStatus; quantity: number } => {
  const count = Number(stockLevel);
  if (stockLevel.trim() !== '' && Number.isFinite(count))
    return { status: count > 0 ? 'inStock' : 'outOfStock', quantity: Math.max(0, count) };
  // A level without a count reports no quantity: 0 here means "unknown", never "sold out".
  return { status: stockLevel === 'OUT_OF_STOCK' ? 'outOfStock' : 'inStock', quantity: 0 };
};

/** The variant a product page shows first: the first one in stock, else the first. */
export const defaultVariantOf = (product: Pick<Product, 'variants'>): Variant | undefined =>
  product.variants.find((variant) => variantAvailability(variant.stockLevel).status === 'inStock') ?? product.variants[0];

/** Plain text of Vendure's HTML description, shortened at a word, for a teaser. */
export const shortDescriptionOf = (html: string, maxLength = 200): string | undefined => {
  const text = plainTextOf(html);
  if (!text) return undefined;
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0) || maxLength)}…`;
};

/** Prices shown with tax: the storefront shows what the customer pays. */
export const productPrices = (product: Pick<Product, 'variants'>, fallbackCurrency: string) => {
  const amounts = product.variants.map((variant) => variant.priceWithTax);
  const currency = product.variants[0]?.currencyCode ?? fallbackCurrency;
  const min = amounts.length ? Math.min(...amounts) : 0;
  const max = amounts.length ? Math.max(...amounts) : 0;

  // Vendure core has no compare-at price, so nothing is on sale by the product's own data.
  return { price: money(min, currency), taxIncluded: true, isOnSale: false, isStartingFrom: min !== max };
};

export const productCover = (product: Pick<Product, 'featuredAsset' | 'assets' | 'name'>): MediaImage | undefined => {
  const asset = product.featuredAsset ?? product.assets.find((candidate) => candidate.type === 'IMAGE');
  return asset ? mapImage(asset, product.name) : undefined;
};

export const productMedia = (product: Pick<Product, 'featuredAsset' | 'assets' | 'name'>) => {
  // The featured asset leads the gallery; Vendure lists it among `assets` too, where it may not be first.
  const ordered: AssetFieldsFragment[] =
    product.featuredAsset ?
      [product.featuredAsset, ...product.assets.filter((asset) => asset.id !== product.featuredAsset!.id)]
    : product.assets;
  // The images are mapped again rather than picked out of `media`: an object answered twice in one
  // response goes over the wire as a back-reference, which a client reading line by line cannot parse.
  const images = mapAssets(
    ordered.filter((asset) => asset.type === 'IMAGE'),
    product.name
  ) as MediaImage[];
  return { media: mapAssets(ordered, product.name), images };
};

/**
 * Each option group with every value, the variant that has it alongside the default variant's other
 * options (or any variant with it), and whether that variant is in stock.
 */
export const productOptionGroups = (product: Pick<Product, 'optionGroups' | 'variants'>) => {
  const preferred = defaultVariantOf(product);
  const optionIdsOf = (variant: Variant) => new Set(variant.options.map((option) => option.id));

  return {
    groups: product.optionGroups.map((group) => ({
      name: group.name,
      wellKnownName: wellKnownOptionName(group),
      values: group.options.map((option) => {
        const withOption = product.variants.filter((variant) => optionIdsOf(variant).has(option.id));
        const otherPreferred = (preferred?.options ?? [])
          .filter((selected) => selected.group.id !== group.id)
          .map((selected) => selected.id);
        const match =
          withOption.find((variant) => otherPreferred.every((id) => optionIdsOf(variant).has(id))) ??
          withOption.find((variant) => variantAvailability(variant.stockLevel).status === 'inStock') ??
          withOption[0];

        return {
          value: option.name,
          variantId: match?.id,
          available: match ? variantAvailability(match.stockLevel).status === 'inStock' : false,
        };
      }),
    })),
  };
};

export const productDefaultVariant = (product: Pick<Product, 'variants'>) => {
  const variant = defaultVariantOf(product);
  if (!variant) return { origin: 'derived' as const };
  return {
    origin: 'derived' as const,
    id: variant.id,
    sku: variant.sku,
    options: variant.options.map((option) => option.name),
    status: variantAvailability(variant.stockLevel).status,
  };
};

/** Facets whose values are a product's marketing badges; Vendure has no field for them. */
const FLAG_FACET_CODES = new Set(['flag', 'flags', 'badge', 'badges', 'label', 'labels']);

/** A facet value's code names a badge the canonical component knows when it is spelled the same way. */
const WELL_KNOWN_FLAGS: ReadonlySet<string> = new Set(WELL_KNOWN_PRODUCT_FLAGS);

/**
 * A product's badges ("New", "Bestseller"), from the values of a facet kept for them. Every other
 * facet — brand, category, colour — describes the product rather than flagging it, so a shop without
 * such a facet answers no flags.
 */
export const productFlags = (product: Pick<Product, 'facetValues'>) => ({
  flags: product.facetValues
    .filter((value) => FLAG_FACET_CODES.has(value.facet.code.toLowerCase()))
    .map((value) => {
      const code = value.code.toLowerCase();
      return { name: value.name, wellKnownName: WELL_KNOWN_FLAGS.has(code) ? code : undefined };
    }),
});

/**
 * The brand, read from the facet whose code is `brand` — Vendure has no brand field, and the demo's
 * and many shops' brand facet is that one. A manufacturer is not the brand in the canonical model.
 */
export const productBrand = (product: Pick<Product, 'facetValues'>) =>
  product.facetValues.find((value) => value.facet.code.toLowerCase() === BRAND_FACET_CODE)?.name;

/** Selected options of a variant, or of an order line's variant, which carries the same names. */
export const variantOptions = (variant: { options: readonly { name: string; group: { code: string; name: string } }[] }) =>
  variant.options.map((option) => ({ name: option.group.name, value: option.name, wellKnownName: wellKnownOptionName(option.group) }));

export const variantPrices = (variant: Pick<Variant, 'priceWithTax' | 'currencyCode'>) => ({
  price: money(variant.priceWithTax, variant.currencyCode),
  taxIncluded: true,
  isOnSale: false,
});

/**
 * The deepest collection a product sits in, which gives the longest and most specific trail. The
 * root collection is not part of a trail.
 */
export const deepestCollectionOf = (product: Pick<Product, 'collections'>) =>
  product.collections.reduce<Product['collections'][number] | undefined>(
    (deepest, collection) => (collection.breadcrumbs.length > (deepest?.breadcrumbs.length ?? 0) ? collection : deepest),
    undefined
  );

/**
 * A product's canonical components, each computed when asked: the Product resolver answers them, and
 * a source entity stores them as the storefront shows the product.
 */
export const productComponents = (product: Product, currencyCode: string) => {
  const cover = productCover(product);
  return {
    base: () => ({ name: product.name, slug: product.slug }),
    defaultVariant: () => productDefaultVariant(product),
    description: () => ({ html: product.description }),
    info: () => ({
      // A product without any image still needs a cover; an image with no source renders nothing.
      cover: cover ?? { type: 'image' as const, sources: [] },
      shortDescription: shortDescriptionOf(product.description),
      brand: productBrand(product),
    }),
    media: () => productMedia(product),
    optionGroups: () => productOptionGroups(product),
    prices: () => productPrices(product, currencyCode),
    seo: () => ({ title: product.name, description: shortDescriptionOf(product.description, 160) }),
    flags: () => productFlags(product),
    brand: () => ({ name: productBrand(product) }),
  };
};

/** A variant's canonical components; its image falls back to the product's. */
export const variantComponents = (variant: Variant, product: Pick<Product, 'featuredAsset'>) => {
  const image = variant.featuredAsset ?? product.featuredAsset;
  return {
    base: () => ({ sku: variant.sku, name: variant.name }),
    info: () => ({ image: image ? mapImage(image, variant.name) : undefined }),
    availability: () => variantAvailability(variant.stockLevel),
    prices: () => variantPrices(variant),
    options: () => ({ selected: variantOptions(variant) }),
    quantityRule: () => ({ min: 1, increment: 1 }),
  };
};
