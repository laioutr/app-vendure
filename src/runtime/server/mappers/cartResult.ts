import { DiscountCodeNotFoundError, ProductNotFoundError, ProductStockError } from '@laioutr-core/canonical-types/ecommerce';
import { mapVendureError, type VendureFailure } from '../errors/mapVendureError';

/**
 * Why one row of a batch was not added, in the canonical batch vocabulary. A row's failure is
 * reported, never thrown: one item must not fail the others.
 */
export const batchRejectionReasonOf = (error: unknown): 'not-found' | 'sold-out' | 'not-orderable' => {
  if (error instanceof ProductNotFoundError || error instanceof DiscountCodeNotFoundError) return 'not-found';
  if (error instanceof ProductStockError) return 'sold-out';
  return 'not-orderable';
};

/**
 * Vendure answers a quantity beyond the stock with `InsufficientStockError` after adding — or setting
 * the line to — what the stock allows, so the change partly happened.
 */
export const stockShortfallOf = (result: { __typename?: string; errorCode?: string | null; quantityAvailable?: number | null }) =>
  result.errorCode === 'INSUFFICIENT_STOCK_ERROR' && (result.quantityAvailable ?? 0) > 0 ? result.quantityAvailable! : undefined;

/** A code the frontend words itself; Vendure's own message text never reaches the browser. */
export const quantityAdjustedMessage = () => ({ code: 'quantity-adjusted', level: 'warning' as const });

export interface ProductRow {
  productId: string;
  variantId: string;
  quantity: number;
}

/** Quantity per variant in a cart, lines of one variant summed. */
export const quantitiesOf = (lines: readonly { quantity: number; productVariant: { id: string } }[] | null | undefined) => {
  const quantities = new Map<string, number>();
  for (const line of lines ?? []) quantities.set(line.productVariant.id, (quantities.get(line.productVariant.id) ?? 0) + line.quantity);
  return quantities;
};

const rejectedRow = (row: ProductRow, reason: ReturnType<typeof batchRejectionReasonOf>) => ({
  status: 'rejected' as const,
  productId: row.productId,
  variantId: row.variantId,
  reason,
});

/**
 * Each row's outcome of one `addItemsToOrder`, told from what the cart held before and after.
 * Vendure adds the rows in order and answers an error only for a row it added less of, in the same
 * order, so the rows that fell short take the errors one by one. A row whose variant the shop does
 * not sell (`sellable`) was never sent and is not found.
 */
export const addedRows = (
  rows: readonly ProductRow[],
  sellable: ReadonlySet<string>,
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
  errorResults: readonly VendureFailure[]
) => {
  const unallotted = new Map([...after].map(([variantId, quantity]) => [variantId, quantity - (before.get(variantId) ?? 0)]));
  const errors = [...errorResults];

  const outcomes = rows.map((row) => {
    if (!sellable.has(row.variantId)) return { item: rejectedRow(row, 'not-found') };
    const quantity = Math.min(row.quantity, Math.max(unallotted.get(row.variantId) ?? 0, 0));
    unallotted.set(row.variantId, (unallotted.get(row.variantId) ?? 0) - quantity);
    if (quantity === row.quantity) return { item: { status: 'added' as const, ...row } };

    const error = errors.shift();
    if (quantity > 0) return { item: { status: 'added' as const, ...row, quantity }, message: quantityAdjustedMessage() };
    return {
      item: rejectedRow(row, error ? batchRejectionReasonOf(mapVendureError(error, { variantId: row.variantId })) : 'not-orderable'),
    };
  });

  if (errors.length)
    console.warn(
      `[vendure] ${errors.length} error(s) of an add to cart matched no row: ${errors.map((error) => error.errorCode).join(', ')}`
    );
  return outcomes;
};
