import type {
  AssetFieldsFragment,
  OrderFieldsFragment,
  OrderLineFieldsFragment,
  ProductFieldsFragment,
  VariantFieldsFragment,
} from '../../src/runtime/server/types/vendure.generated';

export const asset = (overrides: Partial<AssetFieldsFragment> = {}): AssetFieldsFragment => ({
  id: 'a1',
  name: 'laptop.jpg',
  type: 'IMAGE',
  mimeType: 'image/jpeg',
  preview: 'https://shop.example.com/assets/preview/laptop__preview.jpg',
  source: 'https://shop.example.com/assets/source/laptop.jpg',
  width: 3200,
  height: 2400,
  focalPoint: null,
  ...overrides,
});

const group = (id: string, code: string, name: string) => ({ id, code, name });
const SIZE = group('g1', 'laptop-screen-size', 'screen size');
const RAM = group('g2', 'laptop-ram', 'RAM');

export const variant = (overrides: Partial<VariantFieldsFragment> = {}): VariantFieldsFragment => ({
  id: 'v1',
  productId: 'p1',
  sku: 'L-13-8',
  name: 'Laptop 13 inch 8GB',
  price: 1000,
  priceWithTax: 1190,
  currencyCode: 'EUR',
  stockLevel: 'IN_STOCK',
  featuredAsset: null,
  options: [
    { id: 'o13', code: '13-inch', name: '13 inch', group: SIZE },
    { id: 'o8', code: '8gb', name: '8GB', group: RAM },
  ],
  ...overrides,
});

export const product = (overrides: Partial<ProductFieldsFragment> = {}): ProductFieldsFragment => ({
  id: 'p1',
  name: 'Laptop',
  slug: 'laptop',
  description: '<p>A <b>fast</b> laptop &amp; more.</p>',
  featuredAsset: asset({ id: 'a2' }),
  assets: [asset({ id: 'a1' }), asset({ id: 'a2' }), asset({ id: 'a3', type: 'BINARY' })],
  optionGroups: [
    {
      id: 'g1',
      code: 'laptop-screen-size',
      name: 'screen size',
      options: [
        { id: 'o13', code: '13-inch', name: '13 inch' },
        { id: 'o15', code: '15-inch', name: '15 inch' },
      ],
    },
    {
      id: 'g2',
      code: 'laptop-ram',
      name: 'RAM',
      options: [
        { id: 'o8', code: '8gb', name: '8GB' },
        { id: 'o16', code: '16gb', name: '16GB' },
      ],
    },
  ],
  variants: [
    variant({ id: 'v1', stockLevel: 'OUT_OF_STOCK', priceWithTax: 1190 }),
    variant({
      id: 'v2',
      sku: 'L-15-8',
      priceWithTax: 1390,
      options: [
        { id: 'o15', code: '15-inch', name: '15 inch', group: SIZE },
        { id: 'o8', code: '8gb', name: '8GB', group: RAM },
      ],
    }),
    variant({
      id: 'v3',
      sku: 'L-13-16',
      priceWithTax: 1490,
      options: [
        { id: 'o13', code: '13-inch', name: '13 inch', group: SIZE },
        { id: 'o16', code: '16gb', name: '16GB', group: RAM },
      ],
    }),
  ],
  collections: [
    {
      id: 'c2',
      name: 'Electronics',
      slug: 'electronics',
      breadcrumbs: [
        { id: 'c1', name: '__root_collection__', slug: '__root_collection__' },
        { id: 'c2', name: 'Electronics', slug: 'electronics' },
      ],
    },
    {
      id: 'c3',
      name: 'Computers',
      slug: 'computers',
      breadcrumbs: [
        { id: 'c1', name: '__root_collection__', slug: '__root_collection__' },
        { id: 'c2', name: 'Electronics', slug: 'electronics' },
        { id: 'c3', name: 'Computers', slug: 'computers' },
      ],
    },
  ],
  facetValues: [
    { id: 'f1', code: 'apple', name: 'Apple', facet: { id: 'fb', code: 'brand', name: 'Brand' } },
    { id: 'f2', code: 'new', name: 'New', facet: { id: 'ft', code: 'tags', name: 'Tags' } },
  ],
  ...overrides,
});

export const orderLine = (overrides: Partial<OrderLineFieldsFragment> = {}): OrderLineFieldsFragment => ({
  id: 'l1',
  quantity: 2,
  unitPrice: 1000,
  unitPriceWithTax: 1190,
  discountedUnitPriceWithTax: 1071,
  linePriceWithTax: 2380,
  discountedLinePriceWithTax: 2142,
  proratedLinePriceWithTax: 2142,
  lineTax: 380,
  taxRate: 19,
  featuredAsset: asset(),
  discounts: [{ adjustmentSource: 'PROMOTION:1', type: 'PROMOTION', description: '10% off', amount: -200, amountWithTax: -238 }],
  productVariant: {
    id: 'v2',
    productId: 'p1',
    sku: 'L-15-8',
    name: 'Laptop 15 inch 8GB',
    stockLevel: 'LOW_STOCK',
    product: { id: 'p1', name: 'Laptop', slug: 'laptop' },
    options: [
      { code: '15-inch', name: '15 inch', group: { code: 'laptop-screen-size', name: 'screen size' } },
      { code: '8gb', name: '8GB', group: { code: 'laptop-ram', name: 'RAM' } },
    ],
  },
  ...overrides,
});

export const order = (overrides: Partial<OrderFieldsFragment> = {}): OrderFieldsFragment => ({
  id: 'o1',
  code: 'ABC123',
  state: 'AddingItems',
  active: true,
  createdAt: '2026-03-02T10:00:00.000Z',
  orderPlacedAt: null,
  totalQuantity: 2,
  subTotal: 1800,
  subTotalWithTax: 2142,
  shipping: 500,
  shippingWithTax: 595,
  total: 2300,
  totalWithTax: 2737,
  currencyCode: 'EUR',
  couponCodes: [],
  discounts: [],
  taxSummary: [{ description: 'VAT', taxRate: 19, taxBase: 2300, taxTotal: 437 }],
  shippingAddress: null,
  billingAddress: null,
  shippingLines: [],
  customer: null,
  payments: null,
  fulfillments: null,
  lines: [orderLine()],
  ...overrides,
});
