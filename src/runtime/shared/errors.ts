import { BadRequestError } from '@ebec/http';

/**
 * Why Vendure refused a step of an order that no canonical error names. Codes, never prose: the
 * frontend maps each to its own text.
 *
 * - `order-not-ready` — the order cannot move to the asked state yet (no customer, address or
 *   shipping method), Vendure `ORDER_STATE_TRANSITION_ERROR`.
 * - `order-not-modifiable` — the order left `AddingItems`, so its lines are fixed until it returns
 *   there, `ORDER_MODIFICATION_ERROR`.
 * - `order-rejected` — a server-side order interceptor refused the change, `ORDER_INTERCEPTOR_ERROR`.
 * - `no-active-order` — the visitor has no order to act on, `NO_ACTIVE_ORDER_ERROR`.
 * - `shipping-method-not-eligible`, `payment-method-not-eligible` — the method does not apply to this
 *   order.
 * - `payment-failed`, `payment-declined` — the payment handler refused the payment.
 * - `order-not-awaiting-payment` — a payment was added outside `ArrangingPayment`.
 * - `coupon-removed` — a coupon stopped applying while paying, so the total changed.
 * - `guest-checkout-disabled` — the shop requires an account to order.
 * - `already-signed-in` — a guest customer was set while a customer is signed in; the signed-in one
 *   is used.
 *
 * @public
 */
export const VENDURE_ORDER_ERROR_REASONS = [
  'order-not-ready',
  'order-not-modifiable',
  'order-rejected',
  'no-active-order',
  'shipping-method-not-eligible',
  'payment-method-not-eligible',
  'payment-failed',
  'payment-declined',
  'order-not-awaiting-payment',
  'coupon-removed',
  'guest-checkout-disabled',
  'already-signed-in',
] as const;

export type VendureOrderErrorReason = (typeof VENDURE_ORDER_ERROR_REASONS)[number];

/**
 * Thrown when Vendure refuses a change to the visitor's order for a reason no canonical error
 * covers — mostly the steps of checkout. `reason` is one of {@link VENDURE_ORDER_ERROR_REASONS}.
 *
 * @public
 */
export class VendureOrderError extends BadRequestError {
  declare data: { reason: VendureOrderErrorReason };
  static readonly code = 'VENDURE_ORDER_ERROR';
  constructor(reason: VendureOrderErrorReason) {
    super({ message: `Vendure refused the order change: ${reason}`, code: VendureOrderError.code, data: { reason } });
  }
}
