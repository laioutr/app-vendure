import { describe, expect, it } from 'vitest';
import { checkoutState } from './checkout';
import { order } from '../../../../test/fixtures/vendure';

describe('checkoutState', () => {
  it('maps the order, the methods and the countries', () => {
    const state = checkoutState(
      {
        activeOrder: order({
          shippingAddress: {
            fullName: 'Ada Lovelace',
            company: null,
            streetLine1: 'Main St 1',
            streetLine2: null,
            city: null,
            province: null,
            postalCode: null,
            countryCode: 'gb',
            phoneNumber: null,
          },
        }),
        eligibleShippingMethods: [{ id: '1', code: 'std', name: 'Standard', description: '', price: 500, priceWithTax: 595 }],
        eligiblePaymentMethods: [
          { id: '1', code: 'card', name: 'Card', description: '', isEligible: false, eligibilityMessage: 'Too expensive' },
        ],
        nextOrderStates: ['ArrangingPayment'],
        availableCountries: [{ code: 'de', name: 'Germany' }],
      },
      'USD'
    );
    expect(state.order?.shippingAddress).toEqual({ firstName: 'Ada', lastName: 'Lovelace', address1: 'Main St 1', countryCode: 'GB' });
    expect(state.order?.billingAddress).toBeUndefined();
    expect(state.order?.tax).toEqual({ amount: 437, currency: 'EUR' });
    expect(state.order?.lines[0]).toMatchObject({
      id: 'l1',
      variantId: 'v2',
      subtitle: '15 inch, 8GB',
      unitPrice: { amount: 1190, currency: 'EUR' },
      total: { amount: 2142, currency: 'EUR' },
    });
    expect(state.shippingMethods).toEqual([
      { id: '1', code: 'std', name: 'Standard', description: undefined, price: { amount: 595, currency: 'EUR' } },
    ]);
    expect(state.paymentMethods[0]).toEqual({
      code: 'card',
      name: 'Card',
      description: undefined,
      isEligible: false,
      eligibilityMessage: 'Too expensive',
    });
    expect(state.countries).toEqual([{ code: 'DE', name: 'Germany' }]);
  });

  it('prices methods in the fallback currency while there is no order', () => {
    const state = checkoutState(
      {
        activeOrder: null,
        eligibleShippingMethods: [{ id: '1', code: 's', name: 'S', description: '', price: 1, priceWithTax: 1 }],
        eligiblePaymentMethods: [],
        nextOrderStates: [],
        availableCountries: [],
      },
      'USD'
    );
    expect(state.order).toBeNull();
    expect(state.shippingMethods[0]!.price.currency).toBe('USD');
  });
});
