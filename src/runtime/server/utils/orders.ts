import { knownOrFetched } from './batches';
import type { VendureClient } from '../client/VendureClient';
import type { OrderFieldsFragment } from '../types/vendure.generated';
import type { QueryHandlerArguments } from '@laioutr-core/orchestr/types';
import { ordersToken } from '../const/passthroughTokens';
import { customerOrdersByIds } from '../services/order';

/**
 * The orders a query of this request read, and the others read in one batch. An order query always
 * fills the passthrough, so the batch serves only a resolver asked directly.
 */
export const ordersFor = async (
  client: VendureClient,
  passthrough: QueryHandlerArguments['passthrough'],
  ids: readonly string[]
): Promise<Map<string, OrderFieldsFragment>> => {
  const byId = await knownOrFetched(passthrough.get(ordersToken), ids, (missing) => customerOrdersByIds(client, missing));
  passthrough.set(ordersToken, [...byId.values()]);
  return byId;
};

/** The order a line belongs to, for the OrderItem resolver and link. */
export const linesOf = (orders: Iterable<OrderFieldsFragment>) =>
  new Map([...orders].flatMap((order) => order.lines.map((line) => [line.id, { line, order }] as const)));
