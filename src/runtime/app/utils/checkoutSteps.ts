import { isAddressComplete } from './checkoutForms';
import type { CheckoutMessageKey } from '../i18n/messages';
import type { CheckoutOrder } from './checkoutForms';

export const CHECKOUT_STEPS = ['contact', 'address', 'delivery', 'payment'] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

export const STEP_TITLES: Record<CheckoutStep, CheckoutMessageKey> = {
  contact: 'stepContact',
  address: 'stepAddress',
  delivery: 'stepDelivery',
  payment: 'stepPayment',
};

/**
 * The first step the order still needs. Vendure keeps what each step set on the order, so a shopper
 * who comes back, or reloads the page, continues where they left off.
 */
export const firstOpenStep = (order: Pick<CheckoutOrder, 'customer' | 'shippingAddress' | 'shippingMethodIds'>): CheckoutStep => {
  if (!order.customer) return 'contact';
  if (!isAddressComplete(order.shippingAddress)) return 'address';
  if (order.shippingMethodIds.length === 0) return 'delivery';
  return 'payment';
};

export const stepIndexOf = (step: CheckoutStep) => CHECKOUT_STEPS.indexOf(step);

/** A step can be opened again once the order has got past it; later steps wait for it. */
export const isStepReachable = (step: CheckoutStep, furthest: CheckoutStep) => stepIndexOf(step) <= stepIndexOf(furthest);
