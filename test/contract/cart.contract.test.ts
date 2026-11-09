import { describe, expect, it } from 'vitest';
import { visitor } from './client';
import { CartLineNotFoundError } from '@laioutr-core/canonical-types/ecommerce';
import { cartComponents } from '../../src/runtime/server/mappers/order';
import { addVariants, adjustLine, applyCoupon, removeLine } from '../../src/runtime/server/services/cart';
import { activeOrderOf } from '../../src/runtime/server/services/order';

describe('cart against the Shop API', () => {
  it('adds, changes and removes a line in one visitor session', async () => {
    const shopper = visitor();
    expect(await activeOrderOf(shopper.client())).toBeNull();

    const [added] = await addVariants(shopper.client(), shopper.client(), [{ productId: '1', variantId: '1', quantity: 2 }]);
    expect(added!.item.status).toBe('added');
    expect(shopper.hasSession()).toBe(true);

    const order = await activeOrderOf(shopper.client());
    expect(order?.lines).toHaveLength(1);
    expect(cartComponents(order!).base.totalQuantity).toBe(2);

    await adjustLine(shopper.client(), order!.lines[0]!.id, 3);
    expect((await activeOrderOf(shopper.client()))?.totalQuantity).toBe(3);

    await expect(adjustLine(shopper.client(), '999999999', 1)).rejects.toBeInstanceOf(CartLineNotFoundError);

    await removeLine(shopper.client(), order!.lines[0]!.id);
    expect((await activeOrderOf(shopper.client()))?.lines).toHaveLength(0);
  });

  it('adds several rows in one go and reports an unknown variant and an unknown coupon per row', async () => {
    const shopper = visitor();
    const outcomes = await addVariants(shopper.client(), shopper.client(), [
      { productId: '1', variantId: '1', quantity: 1 },
      { productId: 'x', variantId: '999999', quantity: 1 },
      { productId: '1', variantId: '2', quantity: 2 },
    ]);
    expect(outcomes.map((outcome) => outcome.item)).toMatchObject([
      { status: 'added', variantId: '1', quantity: 1 },
      { status: 'rejected', variantId: '999999', reason: 'not-found' },
      { status: 'added', variantId: '2', quantity: 2 },
    ]);
    expect((await activeOrderOf(shopper.client()))?.totalQuantity).toBe(3);
    expect(await applyCoupon(shopper.client(), 'NOT-A-REAL-CODE')).toMatchObject({ status: 'rejected', reason: 'not-found' });
  });
});
