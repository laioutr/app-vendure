import { describe, expect, it } from 'vitest';
import {
  cartComponents,
  cartCouponComponents,
  cartItemIds,
  cartLineComponents,
  couponCodeOfItemId,
  orderComponents,
  orderLineComponents,
  orderStatusOf,
} from './order';
import { order, orderLine } from '../../../../test/fixtures/vendure';

const checkout = { type: 'url' as const, href: '/checkout' };

describe('cart', () => {
  it('lists lines, then coupons under their own prefix', () => {
    const ids = cartItemIds(order({ couponCodes: ['SAVE10'] }));
    expect(ids).toEqual(['l1', 'coupon:SAVE10']);
    expect(couponCodeOfItemId(ids[1]!)).toBe('SAVE10');
    expect(couponCodeOfItemId('l1')).toBeUndefined();
  });

  it('costs with tax; the total is an estimate until there is a shipping address', () => {
    const { base, cost } = cartComponents(order(), checkout);
    expect(base).toEqual({ totalQuantity: 2, checkoutLink: checkout });
    expect(cost).toMatchObject({
      subtotal: { amount: 2142, currency: 'EUR' },
      total: { amount: 2737, currency: 'EUR' },
      totalIsEstimated: true,
      tax: { total: { amount: 437, currency: 'EUR' }, isIncluded: true },
      shipping: undefined,
    });
    expect(
      cartComponents(
        order({
          shippingAddress: {
            fullName: 'A B',
            company: null,
            streetLine1: 'x',
            streetLine2: null,
            city: 'y',
            province: null,
            postalCode: '1',
            countryCode: 'DE',
            phoneNumber: null,
          },
          shippingLines: [{ id: 's', priceWithTax: 595, shippingMethod: { id: '1', code: 'std', name: 'Standard' } }],
        }),
        checkout
      ).cost
    ).toMatchObject({
      totalIsEstimated: false,
      shipping: { total: { amount: 595, currency: 'EUR' }, isEstimated: false },
    });
  });

  it('pairs a discount with the code only when one code is applied', () => {
    const discounts = [{ adjustmentSource: 'P', type: 'PROMOTION' as const, description: '10%', amount: -100, amountWithTax: -119 }];
    expect(cartComponents(order({ discounts, couponCodes: ['A'] }), checkout).cost.discounts).toEqual([
      { name: '10%', code: 'A', amount: { amount: 119, currency: 'EUR' } },
    ]);
    expect(cartComponents(order({ discounts, couponCodes: ['A', 'B'] }), checkout).cost.discounts![0]!.code).toBeUndefined();
  });

  it('maps a line with its options, link and discounted total', () => {
    const line = cartLineComponents(orderLine(), 'EUR');
    expect(line.base).toMatchObject({ type: 'product', quantity: 2, title: 'Laptop', subtitle: '15 inch, 8GB', code: 'L-15-8' });
    expect(line.base.link).toEqual({ type: 'reference', reference: { type: 'Product', slug: 'laptop', id: 'p1' } });
    expect(line.cost).toMatchObject({
      single: { amount: 1190, currency: 'EUR' },
      subtotal: { amount: 2380, currency: 'EUR' },
      total: { amount: 2142, currency: 'EUR' },
    });
    expect(line.availability).toEqual({ status: 'inStock', quantity: 0 });
    // The cart asks for product data on every line; Vendure has no unit price to put in it.
    expect(line.productData).toEqual({});
    expect(cartCouponComponents('SAVE10', 'EUR').productData).toEqual({});
  });

  it('shows a coupon as a fixed line', () => {
    expect(cartCouponComponents('SAVE10', 'EUR')).toMatchObject({
      base: { type: 'discount-code', code: 'SAVE10' },
      quantityRule: { canChange: false },
    });
  });
});

describe('placed orders', () => {
  it('maps Vendure states to the canonical status', () => {
    expect(orderStatusOf('ArrangingPayment')).toBe('open');
    expect(orderStatusOf('PaymentSettled')).toBe('confirmed');
    expect(orderStatusOf('Shipped')).toBe('confirmed');
    expect(orderStatusOf('Delivered')).toBe('completed');
    expect(orderStatusOf('Cancelled')).toBe('cancelled');
  });

  it('maps a placed order with its payments, deliveries and buyer', () => {
    const placed = order({
      state: 'PartiallyShipped',
      orderPlacedAt: '2026-03-03T10:00:00.000Z',
      customer: { id: 'c1', firstName: 'Ada', lastName: 'Lovelace', emailAddress: 'ada@example.com' },
      payments: [{ id: 'pay', method: 'standard-payment', amount: 2737, state: 'Settled' }],
      fulfillments: [
        {
          id: 'f',
          state: 'Shipped',
          method: 'DHL',
          trackingCode: 'T1',
          createdAt: '2026-03-04T00:00:00.000Z',
          lines: [{ orderLineId: 'l1', quantity: 1 }],
        },
      ],
    });
    const components = orderComponents(placed);
    expect(components.base).toEqual({ number: 'ABC123', placedAt: '2026-03-03T10:00:00.000Z', totalQuantity: 2 });
    expect(components.state).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'paid',
      deliveryStatus: 'partially-shipped',
      cancellable: false,
    });
    expect(components.cost.taxes).toEqual([{ rate: 0.19, amount: { amount: 437, currency: 'EUR' }, name: 'VAT' }]);
    expect(components.deliveries.deliveries).toEqual([
      {
        status: 'shipped',
        statusLabel: 'Shipped',
        shippingMethod: { name: 'DHL' },
        tracking: [{ number: 'T1' }],
        items: [{ orderItemId: 'l1', quantity: 1 }],
      },
    ]);
    expect(components.buyer).toEqual({ placedBy: { name: 'Ada Lovelace', email: 'ada@example.com' } });
    expect(orderLineComponents(placed.lines[0]!, placed).fulfillment).toEqual({ quantityShipped: 1 });
  });
});
