import { productsByIds } from './catalog';
import type { VendureClient } from '../client/VendureClient';
import { operations } from '../client/operations';
import { isErrorResult, mapVendureError } from '../errors/mapVendureError';
import {
  addedRows,
  batchRejectionReasonOf,
  type ProductRow,
  quantitiesOf,
  quantityAdjustedMessage,
  stockShortfallOf,
} from '../mappers/cartResult';

/**
 * Adds product rows to the visitor's cart in at most three calls, however many rows there are: the
 * products, to know which variants the shop sells; the cart's quantities before, when there is a
 * cart; and every sellable row in one `addItemsToOrder`. Only Vendure's refusal of a row is
 * reported per row; a failure of the server or the connection fails the whole add.
 */
export const addVariants = async (client: VendureClient, catalogClient: VendureClient, rows: readonly ProductRow[]) => {
  if (!rows.length) return [];
  try {
    const products = await productsByIds(
      catalogClient,
      rows.map((row) => row.productId)
    );
    const sellable = new Set(products.flatMap((product) => product.variants.map((variant) => variant.id)));
    const sent = rows.filter((row) => sellable.has(row.variantId));
    if (!sent.length) return addedRows(rows, sellable, new Map(), new Map(), []);

    const before =
      client.hasSession ?
        quantitiesOf((await client.request(operations.activeOrderQuantities)).activeOrder?.lines)
      : new Map<string, number>();
    const { addItemsToOrder: result } = await client.request(operations.addItemsToOrder, {
      inputs: sent.map((row) => ({ productVariantId: row.variantId, quantity: row.quantity })),
    });
    return addedRows(rows, sellable, before, quantitiesOf(result.order.lines), result.errorResults);
  } catch (error) {
    console.warn(`[vendure] Adding variants ${rows.map((row) => row.variantId).join(', ')} to the cart failed.`, error);
    throw error;
  }
};

export const applyCoupon = async (client: VendureClient, code: string) => {
  const context = { couponCode: code };
  const { applyCouponCode: result } = await client.request(operations.applyCouponCode, { couponCode: code }, context);
  if (isErrorResult(result))
    return { status: 'rejected' as const, sku: code, reason: batchRejectionReasonOf(mapVendureError(result, context)) };
  return { status: 'added' as const, sku: code, quantity: 1 };
};

/**
 * Sets a line's quantity; zero removes it, as in Vendure. A quantity beyond the stock is set to the
 * stock and answered as a message, since the line did change.
 */
export const adjustLine = async (client: VendureClient, lineId: string, quantity: number) => {
  const context = { lineId };
  const { adjustOrderLine: result } = await client.request(operations.adjustOrderLine, { orderLineId: lineId, quantity }, context);
  if (stockShortfallOf(result) !== undefined) return quantityAdjustedMessage();
  if (isErrorResult(result)) throw mapVendureError(result, context);
  return undefined;
};

export const removeLine = (client: VendureClient, lineId: string) =>
  client.mutate(operations.removeOrderLine, { orderLineId: lineId }, 'removeOrderLine', { lineId });

export const removeCoupon = (client: VendureClient, code: string) =>
  client.request(operations.removeCouponCode, { couponCode: code }, { couponCode: code });
