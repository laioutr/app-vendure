import type { VendureOrderErrorReason } from '../../shared/errors';
import type { CheckoutMessageKey } from '../i18n/messages';

const REASON_PROBLEMS: Record<VendureOrderErrorReason, CheckoutMessageKey> = {
  'order-not-ready': 'orderNotReady',
  'order-not-modifiable': 'orderChanged',
  'order-rejected': 'orderChanged',
  'no-active-order': 'orderChanged',
  'shipping-method-not-eligible': 'shippingNotEligible',
  'payment-method-not-eligible': 'paymentNotEligible',
  'payment-failed': 'paymentFailed',
  'payment-declined': 'paymentDeclined',
  'order-not-awaiting-payment': 'orderChanged',
  'coupon-removed': 'couponRemoved',
  'guest-checkout-disabled': 'guestCheckoutDisabled',
  'already-signed-in': 'orderChanged',
};

/** What a failed action call says about itself: the error class names, the reasons and the HTTP statuses on its way. */
interface ErrorFacts {
  names: Set<string>;
  reasons: Set<string>;
  statuses: Set<number>;
}

/**
 * The refusal arrives wrapped: the fetch error carries the server's answer, whose `data` is the
 * serialized typed error, whose own `data` holds the reason. The walk reads every layer instead of
 * relying on one nesting, and stops at a fixed depth.
 */
const collectFacts = (value: unknown, facts: ErrorFacts, depth = 0): ErrorFacts => {
  if (depth > 6 || typeof value !== 'object' || value === null) return facts;
  const node = value as Record<string, unknown>;
  if (typeof node.name === 'string') facts.names.add(node.name);
  if (typeof node.reason === 'string') facts.reasons.add(node.reason);
  for (const key of ['statusCode', 'status'] as const) if (typeof node[key] === 'number') facts.statuses.add(node[key]);
  for (const key of ['data', 'cause', 'response'] as const) collectFacts(node[key], facts, depth + 1);
  if (Array.isArray(node.errors)) for (const each of node.errors) collectFacts(each, facts, depth + 1);
  return facts;
};

const isReason = (reason: string): reason is VendureOrderErrorReason => reason in REASON_PROBLEMS;

/**
 * The words to tell the shopper why a checkout action failed. Only the typed errors the actions
 * declare are told apart; everything else — a network failure, a server fault — is "try again",
 * never the server's own text.
 */
export const checkoutProblemOf = (error: unknown): CheckoutMessageKey => {
  const facts = collectFacts(error, { names: new Set(), reasons: new Set(), statuses: new Set() });
  const reason = [...facts.reasons].find(isReason);
  if (reason) return REASON_PROBLEMS[reason];
  // A conflict is the only one `set-customer` declares, and class names can be shortened by a build.
  if (facts.names.has('EmailAlreadyInUseError') || facts.statuses.has(409)) return 'emailInUse';
  if (facts.names.has('InvalidFieldError')) return 'checkDetails';
  return 'unknown';
};

/** Whether the order is gone or changed under the shopper, so the page reads it again before going on. */
export const needsReload = (problem: CheckoutMessageKey) => problem === 'orderChanged' || problem === 'couponRemoved';
