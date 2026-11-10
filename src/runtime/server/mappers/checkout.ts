import { toPartialAddress } from './address';
import { money } from './money';
import { lineSubtitle, mapDiscounts, taxOf } from './order';
import { plainTextOf } from './text';
import type { VendureOrderErrorReason } from '../../shared/errors';
import type { CheckoutStateQuery, OrderFieldsFragment } from '../types/vendure.generated';

const sum = (amounts: readonly number[]) => amounts.reduce((total, amount) => total + amount, 0);

/**
 * The order as checkout shows it. Lines and shipping are their prices before any promotion and
 * `discounts` lists every promotion — on a line, on the order, on shipping — so the summary adds up:
 * subtotal + shipping − discounts = total. Vendure's own `subTotalWithTax` already has order-level
 * promotions taken off, which would leave the difference unexplained.
 */
export const checkoutOrder = (order: OrderFieldsFragment) => {
  const currency = order.currencyCode;
  return {
    id: order.id,
    code: order.code,
    state: order.state,
    customer:
      order.customer ?
        { email: order.customer.emailAddress, firstName: order.customer.firstName, lastName: order.customer.lastName }
      : undefined,
    shippingAddress: toPartialAddress(order.shippingAddress),
    billingAddress: toPartialAddress(order.billingAddress),
    shippingMethodIds: order.shippingLines.map((line) => line.shippingMethod.id),
    couponCodes: order.couponCodes,
    totalQuantity: order.totalQuantity,
    subtotal: money(sum(order.lines.map((line) => line.linePriceWithTax)), currency),
    shipping: money(sum(order.shippingLines.map((line) => line.priceWithTax)), currency),
    // Without the coupon codes: a code is shown on its own, and which promotion it unlocked is not certain.
    discounts: mapDiscounts(order.discounts, currency).map(({ name, amount }) => ({ name, amount })),
    tax: money(taxOf(order), currency),
    total: money(order.totalWithTax, currency),
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productVariant.productId,
      variantId: line.productVariant.id,
      title: line.productVariant.product.name,
      subtitle: lineSubtitle(line),
      sku: line.productVariant.sku,
      quantity: line.quantity,
      unitPrice: money(line.unitPriceWithTax, currency),
      subtotal: money(line.linePriceWithTax, currency),
      total: money(line.discountedLinePriceWithTax, currency),
      imageUrl: line.featuredAsset?.preview,
    })),
  };
};

/** Whether `add-payment` alone completes a payment with the method, rather than a provider's own flow. */
export const completesHere = (code: string, providerPaymentMethods: readonly string[]) => !providerPaymentMethods.includes(code);

/** Payments that already pay for the order: one more would charge the shopper twice. */
const PAYING_STATES = new Set(['Authorized', 'Settled']);

/**
 * Why no payment may be added to the active order now, or nothing when one may: there is no order, it
 * is not awaiting payment, or a payment already went through.
 */
export const paymentRefusalOf = (
  order: { state: string; payments?: readonly { state: string }[] | null } | null | undefined
): VendureOrderErrorReason | undefined => {
  if (!order) return 'no-active-order';
  if (order.state !== 'ArrangingPayment') return 'order-not-awaiting-payment';
  if (order.payments?.some((payment) => PAYING_STATES.has(payment.state))) return 'order-not-awaiting-payment';
  return undefined;
};

/** The payment method codes of a comma- or space-separated setting. */
export const paymentMethodCodesOf = (setting: string | undefined): string[] => (setting ?? '').split(/[\s,]+/).filter(Boolean);

/**
 * `providerPaymentMethods` are paid in a provider's own flow (a card widget, a redirect), which
 * `add-payment` alone cannot complete; they are answered as not completing here.
 */
export const checkoutState = (state: CheckoutStateQuery, fallbackCurrency: string, providerPaymentMethods: readonly string[]) => {
  const currency = state.activeOrder?.currencyCode ?? fallbackCurrency;
  return {
    order: state.activeOrder ? checkoutOrder(state.activeOrder) : null,
    shippingMethods: state.eligibleShippingMethods.map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      description: plainTextOf(method.description) || undefined,
      price: money(method.priceWithTax, currency),
    })),
    paymentMethods: state.eligiblePaymentMethods.map((method) => ({
      code: method.code,
      name: method.name,
      description: plainTextOf(method.description) || undefined,
      isEligible: method.isEligible,
      eligibilityMessage: method.eligibilityMessage ?? undefined,
      completesHere: completesHere(method.code, providerPaymentMethods),
    })),
    nextStates: state.nextOrderStates,
    countries: state.availableCountries.map((country) => ({ code: country.code.toUpperCase(), name: country.name })),
  };
};
