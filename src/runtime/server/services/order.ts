import { productsKnownOrFetched } from './catalog';
import { UnauthenticatedError } from '@laioutr-core/canonical-types/ecommerce';
import type { VendureClient } from '../client/VendureClient';
import type { VariantEntry } from '../const/passthroughTokens';
import type { CustomerOrdersQueryVariables, OrderFieldsFragment } from '../types/vendure.generated';
import { operations } from '../client/operations';
import { MAX_PAGE_SIZE } from '../const';
import { inPages } from '../utils/batches';

/** The visitor's cart. A visitor without a session has none, and asking would only start one. */
export const activeOrderOf = async (client: VendureClient): Promise<OrderFieldsFragment | null> =>
  client.hasSession ? (await client.request(operations.activeOrder)).activeOrder : null;

type OrderListOptions = NonNullable<CustomerOrdersQueryVariables['options']>;

/** One page of the signed-in customer's orders; a visitor who is not signed in has none to read. */
const ordersPage = async (client: VendureClient, options: OrderListOptions) => {
  if (!client.hasSession) throw new UnauthenticatedError();
  const { activeCustomer } = await client.request(operations.customerOrders, {
    options: { ...options, take: Math.min(options.take ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE) },
  });
  if (!activeCustomer) throw new UnauthenticatedError();
  return activeCustomer.orders;
};

/** The signed-in customer's placed orders, newest first. */
export const customerOrders = (client: VendureClient, page: { skip: number; take: number }) =>
  ordersPage(client, { skip: page.skip, take: page.take, sort: { orderPlacedAt: 'DESC' }, filter: { active: { eq: false } } });

/** The signed-in customer's orders among `ids`, a hundred per call; ids that are not theirs are left out. */
export const customerOrdersByIds = async (client: VendureClient, ids: readonly string[]): Promise<OrderFieldsFragment[]> =>
  (await inPages(ids, (batch) => ordersPage(client, { take: batch.length, filter: { id: { in: batch } } }))).flatMap((page) => page.items);

/**
 * One of the signed-in customer's orders, or null. The Shop API answers an anonymous visitor's
 * request for an order with null too, so the customer is read in the same request to tell the two apart.
 */
export const orderOfCustomer = async (client: VendureClient, orderId: string) => {
  if (!client.hasSession) throw new UnauthenticatedError();
  const { activeCustomer, order } = await client.request(operations.orderById, { id: orderId }, { orderId });
  if (!activeCustomer) throw new UnauthenticatedError();
  return order;
};

/**
 * Variant entries for the lines of orders, read through their products: the Shop API reads no
 * variant by its id, and a line carries too little of its variant for the ProductVariant resolver.
 */
export const variantEntriesOfLines = async (client: VendureClient, orders: readonly OrderFieldsFragment[]): Promise<VariantEntry[]> => {
  const lines = orders.flatMap((order) => order.lines);
  const products = await productsKnownOrFetched(
    client,
    [],
    lines.map((line) => line.productVariant.productId)
  );
  return [...products.values()].flatMap((product) => product.variants.map((variant) => ({ variant, product })));
};

/** Every order the customer placed in a calendar year (UTC), read a hundred at a time. */
export const customerOrdersOfYear = async (client: VendureClient, year: number) => {
  const filter = { orderPlacedAt: { between: { start: `${year}-01-01T00:00:00.000Z`, end: `${year + 1}-01-01T00:00:00.000Z` } } };
  const orders: OrderFieldsFragment[] = [];
  for (let skip = 0; ; skip += MAX_PAGE_SIZE) {
    const page = await ordersPage(client, { skip, take: MAX_PAGE_SIZE, filter });
    orders.push(...page.items);
    if (orders.length >= page.totalItems || page.items.length === 0) return orders;
  }
};
