import type { VendureClient } from '../client/VendureClient';
import type { OrderFieldsFragment } from '../types/vendure.generated';
import type { QueryHandlerArguments } from '@laioutr-core/orchestr/types';
import { activeOrderToken } from '../const/passthroughTokens';
import { activeOrderOf } from '../services/order';

/** The cart a query of this request already read, or read now and kept for the next handler. */
export const activeOrderFor = async (
  client: VendureClient,
  passthrough: QueryHandlerArguments['passthrough']
): Promise<OrderFieldsFragment | null> => {
  if (passthrough.has(activeOrderToken)) return passthrough.get(activeOrderToken) ?? null;
  const order = await activeOrderOf(client);
  passthrough.set(activeOrderToken, order);
  return order;
};
