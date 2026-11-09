import { describe, expect, it } from 'vitest';

/**
 * A product feed reads the catalogue through the storefront's orchestr endpoint: an empty search,
 * page after page, with the components a channel's columns need and the variants of each product.
 * This sends exactly that request to a running storefront with this app — the playground, pointed at
 * the server under test — and checks every page and the fields a feed's columns read. Skipped without
 * `VENDURE_CONTRACT_STOREFRONT_URL`.
 */
const STOREFRONT_URL = process.env.VENDURE_CONTRACT_STOREFRONT_URL;
const PAGE_SIZE = 50;

const PRODUCT_COMPONENTS = ['base', 'prices', 'media', 'info', 'flags', 'seo', 'defaultVariant', 'optionGroups', 'description', 'brand'];
const VARIANT_COMPONENTS = ['base', 'prices', 'availability', 'options', 'info'];

interface Chunk {
  type: string;
  id?: string;
  entityType?: string;
  entityTotal?: number;
  entityIds?: string[];
  components?: Record<string, any>;
  links?: { sourceId: string; targetIds: string[] }[];
  error?: { name?: string; message?: string; data?: { components?: string[] } };
}

/** The endpoint answers one chunk per line, `<n>:<json>`, with `u` standing for `undefined`. */
const decode = (text: string): Chunk[] =>
  text
    .split('\n')
    .filter((line) => /^\d+:\{/.test(line))
    .map((line) => JSON.parse(line.slice(line.indexOf(':') + 1).replace(/([:,[])u(?=[,\]}])/g, '$1null')) as Chunk);

const feedPage = async (offset: number, components: string[]) => {
  const response = await fetch(`${STOREFRONT_URL}/api/orchestr/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientEnv: { languageId: 'en', locale: 'en', currency: 'USD' },
      queries: [
        {
          id: 'feed',
          queryName: 'ecommerce/product/search',
          arguments: { query: '' },
          components,
          links: { 'ecommerce/product/variants': { components: VARIANT_COMPONENTS } },
          pagination: { offset, limit: PAGE_SIZE },
        },
      ],
    }),
  });
  expect(response.status).toBe(200);
  const text = await response.text();
  // An object answered twice goes over the wire as a back-reference (`@12`); a feed reads line by
  // line and drops such a chunk, so a product carrying one would be missing from the feed.
  expect(text).not.toMatch(/[[,:]@\d+/);
  return decode(text);
};

const get = (value: unknown, path: string): unknown[] => {
  const [head, ...rest] = path.split('.');
  const many = head!.endsWith('[]');
  const key = many ? head!.slice(0, -2) : head!;
  const next = (value as Record<string, unknown> | undefined)?.[key];
  const values = many ? ((next as unknown[]) ?? []) : [next];
  return rest.length ? values.flatMap((item) => get(item, rest.join('.'))) : values;
};

describe.skipIf(!STOREFRONT_URL)('a product feed through the storefront', () => {
  it('names the components Vendure cannot answer, so discovery can ask again without them', async () => {
    const chunks = await feedPage(0, [...PRODUCT_COMPONENTS, 'specifications', 'rating']);
    const error = chunks.find((chunk) => chunk.type === 'error');
    expect(error?.error?.data?.components?.sort()).toEqual(['rating', 'specifications']);
  });

  it('pages through every product of an empty search once, in a stable order, with every variant', async () => {
    const seen: string[] = [];
    const products: Chunk[] = [];
    const variants = new Map<string, Chunk>();
    const variantsOf = new Map<string, string[]>();
    let total = Infinity;

    for (let offset = 0; offset < total; offset += PAGE_SIZE) {
      const chunks = await feedPage(offset, PRODUCT_COMPONENTS);
      expect(chunks.find((chunk) => chunk.type === 'error')).toBeUndefined();
      const result = chunks.find((chunk) => chunk.type === 'queryResult')!;
      total = result.entityTotal!;
      seen.push(...result.entityIds!);
      for (const chunk of chunks) {
        if (chunk.type === 'entity' && chunk.entityType === 'Product') products.push(chunk);
        if (chunk.type === 'entity' && chunk.entityType === 'ProductVariant') variants.set(chunk.id!, chunk);
        for (const link of chunk.type === 'linkCollection' ? chunk.links! : []) variantsOf.set(link.sourceId, link.targetIds);
      }
    }

    expect(seen.length).toBe(total);
    expect(new Set(seen).size).toBe(total);
    expect(products.length).toBe(total);
    for (const id of seen) expect(variantsOf.get(id)?.length).toBeGreaterThan(0);
    for (const ids of variantsOf.values()) for (const id of ids) expect(variants.has(id)).toBe(true);

    // The fields a feed's columns read by default: how many products have each, for the report.
    const filled = (path: string, from: Chunk[]) =>
      from.filter((chunk) => get(chunk.components, path).some((value) => value !== undefined && value !== null && value !== '')).length;
    const productFields = [
      'base.name',
      'base.slug',
      'description.html',
      'prices.price',
      'prices.strikethroughPrice',
      'media.cover.sources[].src',
      'media.images[].sources[].src',
      'info.cover.sources[].src',
      'info.brand',
      'brand.name',
      'defaultVariant.sku',
      'defaultVariant.options[]',
      'defaultVariant.status',
    ];
    const variantFields = [
      'base.sku',
      'base.gtin',
      'prices.price',
      'prices.strikethroughPrice',
      'options.selected[]',
      'availability.status',
      'availability.quantity',
    ];
    const report = {
      products: total,
      product: Object.fromEntries(productFields.map((path) => [path, filled(path, products)])),
      variants: variants.size,
      variant: Object.fromEntries(variantFields.map((path) => [path, filled(path, [...variants.values()])])),
    };
    // The fields filled, for the run's report.
    console.warn(`[distributr] ${JSON.stringify(report)}`);
    for (const path of ['base.name', 'base.slug', 'prices.price', 'defaultVariant.sku', 'defaultVariant.status'])
      expect(report.product[path]).toBe(total);
    for (const path of ['base.sku', 'prices.price', 'availability.status']) expect(report.variant[path]).toBe(variants.size);
  });
});
