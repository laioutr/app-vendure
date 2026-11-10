import { describe, expect, it } from 'vitest';
import { checkoutOrder, checkoutState, paymentMethodCodesOf, paymentRefusalOf } from './checkout';
import { order, orderLine } from '../../../../test/fixtures/vendure';

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
          { id: '2', code: 'stripe', name: 'Stripe', description: '', isEligible: true, eligibilityMessage: null },
        ],
        nextOrderStates: ['ArrangingPayment'],
        availableCountries: [{ code: 'de', name: 'Germany' }],
      },
      'USD',
      ['stripe']
    );
    expect(state.order?.shippingAddress).toEqual({ firstName: 'Ada', lastName: 'Lovelace', address1: 'Main St 1', countryCode: 'GB' });
    expect(state.order?.billingAddress).toBeUndefined();
    expect(state.order?.tax).toEqual({ amount: 437, currency: 'EUR' });
    expect(state.order?.lines[0]).toMatchObject({
      id: 'l1',
      variantId: 'v2',
      subtitle: '15 inch, 8GB',
      unitPrice: { amount: 1190, currency: 'EUR' },
      subtotal: { amount: 2380, currency: 'EUR' },
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
      completesHere: true,
    });
    expect(state.paymentMethods[1]).toMatchObject({ code: 'stripe', completesHere: false });
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
      'USD',
      []
    );
    expect(state.order).toBeNull();
    expect(state.shippingMethods[0]!.price.currency).toBe('USD');
  });
});

describe('paymentMethodCodesOf', () => {
  it('reads codes separated by commas or spaces, and none from an empty setting', () => {
    expect(paymentMethodCodesOf('stripe, mollie  klarna')).toEqual(['stripe', 'mollie', 'klarna']);
    expect(paymentMethodCodesOf(undefined)).toEqual([]);
    expect(paymentMethodCodesOf(' ')).toEqual([]);
  });
});

describe('checkoutOrder', () => {
  const promotion = (source: string, description: string, amountWithTax: number) => ({
    adjustmentSource: source,
    type: 'PROMOTION' as const,
    description,
    amount: Math.round(amountWithTax / 1.19),
    amountWithTax,
  });

  it('lists every promotion so that subtotal + shipping - discounts = total', () => {
    const lineOff = promotion('PROMOTION:1', '10% off laptops', -238);
    const orderOff = promotion('PROMOTION:2', '€2.14 off orders over €20', -214);
    const shippingOff = promotion('PROMOTION:3', 'Free shipping', -595);
    const mapped = checkoutOrder(
      order({
        couponCodes: ['WELCOME'],
        lines: [orderLine({ linePriceWithTax: 2380, discountedLinePriceWithTax: 2142, discounts: [lineOff, orderOff] })],
        shippingLines: [{ id: 's1', priceWithTax: 595, shippingMethod: { id: '1', code: 'std', name: 'Standard' } }],
        shippingWithTax: 0,
        subTotalWithTax: 1928,
        discounts: [lineOff, orderOff, shippingOff],
        totalWithTax: 1928,
      })
    );
    expect(mapped.subtotal).toEqual({ amount: 2380, currency: 'EUR' });
    expect(mapped.shipping).toEqual({ amount: 595, currency: 'EUR' });
    expect(mapped.discounts).toEqual([
      { name: '10% off laptops', amount: { amount: 238, currency: 'EUR' } },
      { name: '€2.14 off orders over €20', amount: { amount: 214, currency: 'EUR' } },
      { name: 'Free shipping', amount: { amount: 595, currency: 'EUR' } },
    ]);
    const discounted = mapped.discounts.reduce((sum, discount) => sum + discount.amount.amount, 0);
    expect(mapped.subtotal.amount + mapped.shipping.amount - discounted).toBe(mapped.total.amount);
  });

  it('has no discounts without a promotion, and then lines + shipping = total', () => {
    const mapped = checkoutOrder(
      order({
        lines: [orderLine({ linePriceWithTax: 2380, discountedLinePriceWithTax: 2380, discounts: [] })],
        shippingLines: [{ id: 's1', priceWithTax: 595, shippingMethod: { id: '1', code: 'std', name: 'Standard' } }],
        totalWithTax: 2975,
      })
    );
    expect(mapped.discounts).toEqual([]);
    expect(mapped.subtotal.amount + mapped.shipping.amount).toBe(mapped.total.amount);
  });
});

describe('paymentRefusalOf', () => {
  it('allows a payment only on an order awaiting payment that no payment has paid yet', () => {
    expect(paymentRefusalOf({ state: 'ArrangingPayment', payments: null })).toBeUndefined();
    expect(paymentRefusalOf({ state: 'ArrangingPayment', payments: [{ state: 'Declined' }, { state: 'Error' }] })).toBeUndefined();
    expect(paymentRefusalOf({ state: 'ArrangingPayment', payments: [{ state: 'Authorized' }] })).toBe('order-not-awaiting-payment');
    expect(paymentRefusalOf({ state: 'AddingItems', payments: [] })).toBe('order-not-awaiting-payment');
    expect(paymentRefusalOf(null)).toBe('no-active-order');
  });
});
