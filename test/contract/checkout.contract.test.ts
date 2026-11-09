import { describe, expect, it } from 'vitest';
import { visitor } from './client';
import { OrderNotFoundError } from '@laioutr-core/canonical-types/ecommerce';
import { addVariants } from '../../src/runtime/server/services/cart';
import {
  addPayment,
  getCheckoutState,
  orderByCode,
  setBillingAddress,
  setCustomer,
  setShippingAddress,
  setShippingMethod,
  transitionOrder,
} from '../../src/runtime/server/services/checkout';
import { VendureOrderError } from '../../src/runtime/shared/errors';

const address = { firstName: 'Contract', lastName: 'Test', address1: 'Teststrasse 1', city: 'Berlin', postalCode: '10115', countryCode: 'DE' };

describe('guest checkout against the Shop API', () => {
  it('places an order step by step and reads it back by its code', async () => {
    const shopper = visitor();
    await addVariants(shopper.client(), shopper.client(), [{ productId: '1', variantId: '1', quantity: 1 }]);

    await expect(transitionOrder(shopper.client(), 'ArrangingPayment')).rejects.toBeInstanceOf(VendureOrderError);

    await setCustomer(shopper.client(), { email: `laioutr-contract-${Date.now()}@example.com`, firstName: 'Contract', lastName: 'Test' });
    await setShippingAddress(shopper.client(), address);
    await setBillingAddress(shopper.client(), address);

    const state = await getCheckoutState(shopper.client(), 'USD');
    expect(state.order?.shippingAddress).toMatchObject({ city: 'Berlin', countryCode: 'DE' });
    expect(state.shippingMethods.length).toBeGreaterThan(0);
    expect(state.paymentMethods.length).toBeGreaterThan(0);
    expect(state.nextStates).toContain('ArrangingPayment');

    await setShippingMethod(shopper.client(), [state.shippingMethods[0]!.id]);
    expect(await transitionOrder(shopper.client(), 'ArrangingPayment')).toEqual({ state: 'ArrangingPayment' });

    const payment = await addPayment(shopper.client(), state.paymentMethods.find((method) => method.isEligible)!.code, {});
    // The demo's only method, `standard-payment`, authorizes at once.
    expect(['PaymentAuthorized', 'PaymentSettled']).toContain(payment.state);

    const { order } = await orderByCode(shopper.client(), payment.code, true);
    expect(order.code).toBe(payment.code);
    expect(order.shippingMethodIds).toEqual([state.shippingMethods[0]!.id]);

    // Vendure itself would answer this guest order to anyone with its code for a while.
    const stranger = visitor();
    await addVariants(stranger.client(), stranger.client(), [{ productId: '1', variantId: '1', quantity: 1 }]);
    await expect(orderByCode(stranger.client(), payment.code, false)).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(orderByCode(visitor().client(), payment.code, false)).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(orderByCode(shopper.client(), 'NO-SUCH-ORDER', true)).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
