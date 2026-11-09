import { toMailingAddress } from './address';
import { mapImage } from './media';
import { money } from './money';
import { variantAvailability, variantOptions } from './product';
import type { DiscountFieldsFragment, OrderFieldsFragment, OrderLineFieldsFragment } from '../types/vendure.generated';
import type { Money } from '@laioutr-core/core-types/common';

type Order = OrderFieldsFragment;
type Line = OrderLineFieldsFragment;

/** The id of a coupon code shown as a cart line, kept apart from Vendure's numeric line ids. */
const COUPON_ITEM_PREFIX = 'coupon:';
export const couponItemId = (code: string) => `${COUPON_ITEM_PREFIX}${code}`;
export const couponCodeOfItemId = (itemId: string): string | undefined =>
  itemId.startsWith(COUPON_ITEM_PREFIX) ? itemId.slice(COUPON_ITEM_PREFIX.length) : undefined;

/** A discount amount as the positive value it took off; Vendure answers it negative. */
const mapDiscounts = (discounts: readonly DiscountFieldsFragment[], currency: string, couponCodes: readonly string[] = []) =>
  discounts.map((discount) => ({
    name: discount.description,
    // Vendure links a discount to its promotion, not to the code that unlocked it; a single code is
    // the only case where the pairing is certain.
    code: couponCodes.length === 1 ? couponCodes[0] : undefined,
    amount: money(Math.abs(discount.amountWithTax), currency),
  }));

/** The tax an order's total includes. */
export const taxOf = (order: Pick<Order, 'total' | 'totalWithTax'>) => order.totalWithTax - order.total;

/** A line's variant options, or the variant's own name where it differs from the product's. */
export const lineSubtitle = (line: Line) => {
  const options = line.productVariant.options.map((option) => option.name).join(', ');
  if (options) return options;
  return line.productVariant.name === line.productVariant.product.name ? undefined : line.productVariant.name;
};

const lineLink = (line: Line) => ({
  type: 'reference' as const,
  reference: { type: 'Product' as const, slug: line.productVariant.product.slug, id: line.productVariant.product.id },
});

/** The cart's item ids: its lines, then its coupon codes. */
export const cartItemIds = (order: Pick<Order, 'lines' | 'couponCodes'>) => [
  ...order.lines.map((line) => line.id),
  ...order.couponCodes.map(couponItemId),
];

export const cartComponents = (order: Order) => {
  const currency = order.currencyCode;
  return {
    // Vendure has no hosted checkout to link to; the storefront runs it through the checkout actions.
    base: { totalQuantity: order.totalQuantity },
    cost: {
      subtotal: money(order.subTotalWithTax, currency),
      subtotalIsEstimated: false,
      total: money(order.totalWithTax, currency),
      // Before an address is set, tax and shipping follow the channel's default zone.
      totalIsEstimated: !order.shippingAddress?.countryCode,
      taxIncluded: true,
      discounts: order.discounts.length ? mapDiscounts(order.discounts, currency, order.couponCodes) : undefined,
      tax: { total: money(taxOf(order), currency), isEstimated: !order.shippingAddress?.countryCode, isIncluded: true },
      shipping: order.shippingLines.length ? { total: money(order.shippingWithTax, currency), isEstimated: false } : undefined,
    },
  };
};

export const cartLineComponents = (line: Line, currency: string) => {
  const availability = variantAvailability(line.productVariant.stockLevel);
  return {
    base: {
      type: 'product' as const,
      quantity: line.quantity,
      title: line.productVariant.product.name,
      subtitle: lineSubtitle(line),
      code: line.productVariant.sku,
      cover: line.featuredAsset ? mapImage(line.featuredAsset, line.productVariant.name) : undefined,
      link: lineLink(line),
    },
    cost: {
      single: money(line.unitPriceWithTax, currency),
      subtotal: money(line.linePriceWithTax, currency),
      total: money(line.discountedLinePriceWithTax, currency),
      discounts: line.discounts.length ? mapDiscounts(line.discounts, currency) : undefined,
    },
    availability: { status: availability.status, quantity: availability.quantity },
    quantityRule: { min: 1, increment: 1, canChange: true },
  };
};

export const cartCouponComponents = (code: string, currency: string) => ({
  base: { type: 'discount-code' as const, quantity: 1, title: code, code },
  cost: { single: money(0, currency), subtotal: money(0, currency), total: money(0, currency) },
  availability: { status: 'inStock' as const, quantity: 1 },
  quantityRule: { min: 1, max: 1, increment: 1, canChange: false },
});

/**
 * Vendure order states (the default process) onto the canonical status. Fulfilment is reported as
 * the delivery status, so a shipped order stays `confirmed` until it is delivered.
 */
export const orderStatusOf = (state: string): string => {
  switch (state) {
    case 'Created':
    case 'Draft':
    case 'AddingItems':
    case 'ArrangingPayment':
      return 'open';
    case 'Modifying':
    case 'ArrangingAdditionalPayment':
      return 'on-hold';
    case 'Delivered':
      return 'completed';
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'confirmed';
  }
};

export const paymentStatusOf = (state: string | undefined): string | undefined => {
  switch (state) {
    case 'Created':
      return 'pending';
    case 'Authorized':
      return 'authorized';
    case 'Settled':
      return 'paid';
    case 'Declined':
    case 'Error':
      return 'failed';
    case 'Cancelled':
      return 'cancelled';
    default:
      return undefined;
  }
};

export const deliveryStatusOf = (state: string): string | undefined => {
  switch (state) {
    case 'PartiallyShipped':
      return 'partially-shipped';
    case 'Shipped':
      return 'shipped';
    case 'PartiallyDelivered':
      return 'shipped';
    case 'Delivered':
      return 'delivered';
    case 'Cancelled':
      return 'cancelled';
    case 'PaymentAuthorized':
    case 'PaymentSettled':
      return 'pending';
    default:
      return undefined;
  }
};

const fulfillmentStatusOf = (state: string) =>
  ({ Pending: 'pending', Shipped: 'shipped', Delivered: 'delivered', Cancelled: 'cancelled' })[state];

const SHIPPED_FULFILLMENTS = new Set(['Shipped', 'Delivered']);

export const orderComponents = (order: Order) => {
  const currency = order.currencyCode;
  const latestPayment = order.payments?.at(-1);
  const customerName = order.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') : '';

  return {
    base: { number: order.code, placedAt: order.orderPlacedAt ?? order.createdAt, totalQuantity: order.totalQuantity },
    state: {
      status: orderStatusOf(order.state),
      statusLabel: order.state,
      paymentStatus: paymentStatusOf(latestPayment?.state),
      paymentStatusLabel: latestPayment?.state,
      deliveryStatus: deliveryStatusOf(order.state),
      // The Shop API offers no cancellation; only the merchant cancels.
      cancellable: false,
    },
    cost: {
      subtotal: money(order.subTotalWithTax, currency),
      total: money(order.totalWithTax, currency),
      shipping: money(order.shippingWithTax, currency),
      tax: { total: money(taxOf(order), currency), isIncluded: true },
      taxes: order.taxSummary.map((tax) => ({ rate: tax.taxRate / 100, amount: money(tax.taxTotal, currency), name: tax.description })),
      discounts: order.discounts.length ? mapDiscounts(order.discounts, currency, order.couponCodes) : undefined,
    },
    addresses: {
      shipping: toMailingAddress(order.shippingAddress),
      billing: toMailingAddress(order.billingAddress),
    },
    deliveries: {
      deliveries:
        order.fulfillments?.length ?
          order.fulfillments.map((fulfillment) => ({
            status: fulfillmentStatusOf(fulfillment.state),
            statusLabel: fulfillment.state,
            shippingMethod: { name: fulfillment.method },
            tracking: fulfillment.trackingCode ? [{ number: fulfillment.trackingCode }] : undefined,
            items: fulfillment.lines.map((line) => ({ orderItemId: line.orderLineId, quantity: line.quantity })),
          }))
        : order.shippingLines.map((shippingLine) => ({
            status: 'pending',
            shippingMethod: { name: shippingLine.shippingMethod.name, externalId: shippingLine.shippingMethod.code },
            cost: money(shippingLine.priceWithTax, currency),
          })),
    },
    payments: {
      payments: (order.payments ?? []).map((payment) => ({
        method: { name: payment.method, externalId: payment.method },
        status: paymentStatusOf(payment.state),
        statusLabel: payment.state,
        amount: money(payment.amount, currency),
      })),
    },
    buyer: {
      placedBy: order.customer ? { name: customerName || order.customer.emailAddress, email: order.customer.emailAddress } : undefined,
    },
  };
};

export const orderLineComponents = (line: Line, order: Pick<Order, 'currencyCode' | 'fulfillments'>) => {
  const currency = order.currencyCode;
  const shipped = (order.fulfillments ?? [])
    .filter((fulfillment) => SHIPPED_FULFILLMENTS.has(fulfillment.state))
    .flatMap((fulfillment) => fulfillment.lines)
    .filter((fulfilled) => fulfilled.orderLineId === line.id)
    .reduce((sum, fulfilled) => sum + fulfilled.quantity, 0);
  const lineTax: Money = money(line.lineTax, currency);

  return {
    base: {
      type: 'product' as const,
      quantity: line.quantity,
      title: line.productVariant.product.name,
      subtitle: lineSubtitle(line),
      code: line.productVariant.sku,
      options: variantOptions(line.productVariant),
      cover: line.featuredAsset ? mapImage(line.featuredAsset, line.productVariant.name) : undefined,
      link: lineLink(line),
    },
    cost: {
      single: money(line.unitPriceWithTax, currency),
      subtotal: money(line.linePriceWithTax, currency),
      total: money(line.discountedLinePriceWithTax, currency),
      discounts: line.discounts.length ? mapDiscounts(line.discounts, currency) : undefined,
      tax: { amount: lineTax, isIncluded: true },
    },
    fulfillment: { quantityShipped: shipped },
  };
};
