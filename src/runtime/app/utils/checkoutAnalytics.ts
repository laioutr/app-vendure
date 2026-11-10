import type { CheckoutOrder } from './checkoutForms';
import type { AnalyticsProduct } from '@laioutr-core/canonical-types/analytics';
import type { z } from 'zod/v4';

/**
 * The order's lines in the shape commerce events carry. Checkout reads plain lines, not cart
 * entities, so they are projected here the way a cart line is: the product's id, the variant's SKU.
 */
export const analyticsProductsOf = (order: Pick<CheckoutOrder, 'lines'>): z.infer<typeof AnalyticsProduct>[] =>
  order.lines.map((line, index) => ({
    productId: line.productId,
    sku: line.sku,
    name: line.title,
    ...(line.subtitle ? { variant: line.subtitle } : {}),
    price: line.unitPrice,
    quantity: line.quantity,
    position: index + 1,
    ...(line.imageUrl ? { imageUrl: line.imageUrl } : {}),
  }));

const couponOf = (order: Pick<CheckoutOrder, 'couponCodes'>) => (order.couponCodes.length ? { coupon: order.couponCodes.join(', ') } : {});

const discountOf = (order: Pick<CheckoutOrder, 'discounts' | 'total'>) => {
  const amount = order.discounts.reduce((sum, discount) => sum + discount.amount.amount, 0);
  return amount > 0 ? { discount: { amount, currency: order.total.currency } } : {};
};

// The events before the purchase carry no order number: it is the key Vendure answers a guest's order
// by, so it leaves the page only as the purchase's transaction id.
export const shippingInfoOf = (order: CheckoutOrder, shippingTier: string | undefined) => ({
  products: analyticsProductsOf(order),
  value: order.total,
  ...couponOf(order),
  ...(shippingTier ? { shippingTier } : {}),
});

export const paymentInfoOf = (order: CheckoutOrder, paymentType: string) => ({
  products: analyticsProductsOf(order),
  value: order.total,
  paymentType,
  ...couponOf(order),
});

/**
 * A placed order as the purchase event reports it: the order number as its id, which destinations send
 * as the transaction id. No subtotal: the event wants it net of tax and shipping, and the order is read
 * with its gross amounts only.
 */
export const purchaseOf = (order: CheckoutOrder, paymentType: string) => ({
  orderId: order.code,
  products: analyticsProductsOf(order),
  value: order.total,
  tax: order.tax,
  shipping: order.shipping,
  ...discountOf(order),
  paymentType,
  ...couponOf(order),
});
