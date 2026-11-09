import { toPartialAddress } from './address';
import { money } from './money';
import { lineSubtitle, taxOf } from './order';
import type { CheckoutStateQuery, OrderFieldsFragment } from '../types/vendure.generated';

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
    subtotal: money(order.subTotalWithTax, currency),
    shipping: money(order.shippingWithTax, currency),
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
      total: money(line.discountedLinePriceWithTax, currency),
      imageUrl: line.featuredAsset?.preview,
    })),
  };
};

export const checkoutState = (state: CheckoutStateQuery, fallbackCurrency: string) => {
  const currency = state.activeOrder?.currencyCode ?? fallbackCurrency;
  return {
    order: state.activeOrder ? checkoutOrder(state.activeOrder) : null,
    shippingMethods: state.eligibleShippingMethods.map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      description: method.description || undefined,
      price: money(method.priceWithTax, currency),
    })),
    paymentMethods: state.eligiblePaymentMethods.map((method) => ({
      code: method.code,
      name: method.name,
      description: method.description || undefined,
      isEligible: method.isEligible,
      eligibilityMessage: method.eligibilityMessage ?? undefined,
    })),
    nextStates: state.nextOrderStates,
    countries: state.availableCountries.map((country) => ({ code: country.code.toUpperCase(), name: country.name })),
  };
};
