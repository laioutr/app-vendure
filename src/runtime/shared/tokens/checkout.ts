import { z } from 'zod/v4';
import { MailingAddress } from '@laioutr-core/canonical-types';
import { Money } from '@laioutr-core/core-types/common';
import { defineActionToken } from '@laioutr-core/core-types/orchestr';

/**
 * Checkout on Vendure, step by step.
 *
 * Vendure has no hosted checkout: the storefront sets the customer, the addresses and the shipping
 * method on the active order, moves it to `ArrangingPayment` and adds a payment. These actions are
 * the app's own, under `vendure/checkout/*`; `@laioutr-core/canonical-types` has no checkout tokens.
 *
 * Every refusal is a typed error: a canonical one where one exists (`InvalidFieldError`,
 * `EmailAlreadyInUseError`, `OrderNotFoundError`), else `VendureOrderError` with a reason code.
 */

/**
 * An address as the active order holds it. Vendure stores whatever was sent, so any field may be
 * missing until the customer has entered it.
 *
 * @id VendureCheckoutAddress
 * @title Vendure Checkout Address
 */
export const VendureCheckoutAddress = z.object({ ...MailingAddress.partial().shape });

/**
 * One line of the order, as a confirmation or summary shows it.
 *
 * @id VendureCheckoutLine
 * @title Vendure Checkout Line
 */
export const VendureCheckoutLine = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  sku: z.string(),
  quantity: z.number(),
  /** The price of one unit, with tax. */
  unitPrice: Money,
  /** The line's total after its discounts, with tax. */
  total: Money,
  /** The URL of the line's image, when it has one. */
  imageUrl: z.string().optional(),
});

/**
 * The visitor's order as checkout reads it.
 *
 * @id VendureCheckoutOrder
 * @title Vendure Checkout Order
 */
export const VendureCheckoutOrder = z.object({
  id: z.string(),
  /** The order number the customer is told, and the key of {@link VendureCheckoutOrderByCodeAction}. */
  code: z.string(),
  /** Vendure's order state, e.g. `AddingItems`, `ArrangingPayment`, `PaymentSettled`. */
  state: z.string(),
  customer: z.object({ email: z.string(), firstName: z.string(), lastName: z.string() }).optional(),
  shippingAddress: VendureCheckoutAddress.optional(),
  billingAddress: VendureCheckoutAddress.optional(),
  /** The ids of the shipping methods set on the order. */
  shippingMethodIds: z.array(z.string()),
  couponCodes: z.array(z.string()),
  totalQuantity: z.number(),
  subtotal: Money,
  shipping: Money,
  tax: Money,
  total: Money,
  lines: z.array(VendureCheckoutLine),
});

/**
 * @id VendureShippingMethodQuote
 * @title Vendure Shipping Method Quote
 */
export const VendureShippingMethodQuote = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: Money,
});

/**
 * @id VendurePaymentMethodQuote
 * @title Vendure Payment Method Quote
 */
export const VendurePaymentMethodQuote = z.object({
  /** The value `add-payment` takes as `method`. */
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isEligible: z.boolean(),
  eligibilityMessage: z.string().optional(),
});

/**
 * Everything the checkout page needs at once: the order, the shipping and payment methods that apply
 * to it, the states it can move to, and the countries an address may be in.
 *
 * `order` is null while the visitor has no order (nothing in the cart).
 *
 * @public
 */
export const VendureCheckoutGetStateAction = defineActionToken('vendure/checkout/get-state', {
  output: z.object({
    order: VendureCheckoutOrder.nullable(),
    shippingMethods: z.array(VendureShippingMethodQuote),
    paymentMethods: z.array(VendurePaymentMethodQuote),
    /** Vendure's next states for the order, e.g. `ArrangingPayment`. */
    nextStates: z.array(z.string()),
    /** ISO 3166-1 alpha-2 codes and names of the countries the channel ships to. */
    countries: z.array(z.object({ code: z.string(), name: z.string() })),
  }),
});

/**
 * Names the customer of a guest order. A signed-in customer is the order's customer already.
 *
 * @public
 * @throws {@link EmailAlreadyInUseError} The address belongs to an account; the customer signs in.
 * @throws {@link VendureOrderError} `no-active-order`, `guest-checkout-disabled`, `already-signed-in`.
 */
export const VendureCheckoutSetCustomerAction = defineActionToken('vendure/checkout/set-customer', {
  input: z.object({
    email: z.email(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
  }),
});

/**
 * Sets the shipping address of the order.
 *
 * @public
 * @throws {@link VendureOrderError} `no-active-order`.
 */
export const VendureCheckoutSetShippingAddressAction = defineActionToken('vendure/checkout/set-shipping-address', {
  input: z.object({ address: MailingAddress }),
});

/**
 * Sets the billing address of the order.
 *
 * @public
 * @throws {@link VendureOrderError} `no-active-order`.
 */
export const VendureCheckoutSetBillingAddressAction = defineActionToken('vendure/checkout/set-billing-address', {
  input: z.object({ address: MailingAddress }),
});

/**
 * Sets the shipping method, from the ids `get-state` lists. Several ids split the order across
 * methods, where the shop is set up for it.
 *
 * @public
 * @throws {@link VendureOrderError} `shipping-method-not-eligible`, `order-not-modifiable`, `no-active-order`.
 */
export const VendureCheckoutSetShippingMethodAction = defineActionToken('vendure/checkout/set-shipping-method', {
  input: z.object({ shippingMethodIds: z.array(z.string()).min(1) }),
});

/**
 * Moves the order to `ArrangingPayment` once customer, address and shipping method are set, or back to
 * `AddingItems` to change the cart. Answers the state the order is in.
 *
 * @public
 * @throws {@link VendureOrderError} `order-not-ready` when a step is missing.
 */
export const VendureCheckoutTransitionAction = defineActionToken('vendure/checkout/transition', {
  input: z.object({ state: z.enum(['ArrangingPayment', 'AddingItems']) }),
  output: z.object({ state: z.string() }),
});

/**
 * Adds a payment with one of the methods `get-state` lists. `metadata` goes to the shop's payment
 * handler as it is — a payment provider's token, for instance. When the payment settles or is
 * authorized, the order is placed and leaves the cart; the answer's `code` reads it back.
 *
 * @public
 * @throws {@link VendureOrderError} `payment-method-not-eligible`, `payment-failed`, `payment-declined`,
 * `order-not-awaiting-payment`, `coupon-removed`, `no-active-order`.
 */
export const VendureCheckoutAddPaymentAction = defineActionToken('vendure/checkout/add-payment', {
  input: z.object({
    method: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  output: z.object({ code: z.string(), state: z.string() }),
});

/**
 * Reads an order by its code for the confirmation page. Answered only to the browser that placed it
 * — `add-payment` remembers the code in a signed, http-only cookie — and to the signed-in customer
 * the order belongs to. Anyone else, and any unknown or expired code, gets {@link OrderNotFoundError}.
 * Vendure stops answering a guest's order some time after it was placed (two hours by default).
 *
 * @public
 * @throws {@link OrderNotFoundError}
 */
export const VendureCheckoutOrderByCodeAction = defineActionToken('vendure/checkout/order-by-code', {
  input: z.object({ code: z.string() }),
  output: z.object({ order: VendureCheckoutOrder }),
});
