import { describe, expect, it } from 'vitest';
import { analyticsProductsOf, paymentInfoOf, purchaseOf, shippingInfoOf } from './checkoutAnalytics';
import { checkoutOrder } from '../../../../test/fixtures/checkout';

describe('checkout analytics', () => {
  it('reports each line as a product: its id, SKU, unit price and quantity', () => {
    expect(analyticsProductsOf(checkoutOrder())).toEqual([
      {
        productId: 'p1',
        sku: 'MOUSE',
        name: 'Mouse',
        variant: 'Black',
        price: { amount: 2279, currency: 'USD' },
        quantity: 2,
        position: 1,
        imageUrl: 'https://cdn.example.com/m.jpg',
      },
    ]);
  });

  // Exact payloads, strictly: a field added later (a customer's name, an email) fails here instead of
  // reaching a tag, even while the fixture leaves it undefined.
  it('reports the purchase with the order number as its id, the total, tax, shipping, discount and coupons', () => {
    const order = checkoutOrder({
      customer: { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
      shippingAddress: { firstName: 'Ada', lastName: 'Lovelace', city: 'Berlin' },
      couponCodes: ['SAVE'],
      discounts: [{ name: '10% off', amount: { amount: 456, currency: 'USD' } }],
    });
    expect(purchaseOf(order, 'Card')).toStrictEqual({
      orderId: 'ABC',
      products: analyticsProductsOf(order),
      value: { amount: 5058, currency: 'USD' },
      tax: { amount: 800, currency: 'USD' },
      shipping: { amount: 500, currency: 'USD' },
      discount: { amount: 456, currency: 'USD' },
      paymentType: 'Card',
      coupon: 'SAVE',
    });
    expect(purchaseOf(checkoutOrder(), 'Card')).not.toHaveProperty('discount');
  });

  it('keeps the order number and the customer out of the events before the purchase', () => {
    const order = checkoutOrder({ customer: { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' } });
    expect(shippingInfoOf(order, undefined)).toStrictEqual({ products: analyticsProductsOf(order), value: order.total });
    expect(shippingInfoOf(order, 'Express')).toStrictEqual({
      products: analyticsProductsOf(order),
      value: order.total,
      shippingTier: 'Express',
    });
    expect(paymentInfoOf(order, 'Card')).toStrictEqual({ products: analyticsProductsOf(order), value: order.total, paymentType: 'Card' });
  });
});
