import { computed, ref } from 'vue';
import type { CheckoutMessageKey } from '../i18n/messages';
import type { AddressForm, CheckoutOrder, ContactForm } from '../utils/checkoutForms';
import type { ActionToken, ActionTokenInputOf, ActionTokenOutputOf } from '@laioutr-core/core-types/orchestr';
import {
  VendureCheckoutAddPaymentAction,
  VendureCheckoutGetStateAction,
  VendureCheckoutOrderByCodeAction,
  VendureCheckoutSetBillingAddressAction,
  VendureCheckoutSetCustomerAction,
  VendureCheckoutSetShippingAddressAction,
  VendureCheckoutSetShippingMethodAction,
  VendureCheckoutTransitionAction,
} from '../../shared/tokens/checkout';
import { paymentInfoOf, purchaseOf, shippingInfoOf } from '../utils/checkoutAnalytics';
import { toMailingAddress, trimmedContact } from '../utils/checkoutForms';
import { checkoutProblemOf, needsReload } from '../utils/checkoutProblems';
import { type CheckoutStep, firstOpenStep, isStepReachable } from '../utils/checkoutSteps';

export type CheckoutState = ActionTokenOutputOf<typeof VendureCheckoutGetStateAction>;

/** Sends one action to the server; `fetchAction` in a page, a fake in a test. */
export type CallAction = <T extends ActionToken>(token: T, input?: ActionTokenInputOf<T>) => Promise<ActionTokenOutputOf<T>>;

/** The commerce events checkout reports, each the moment it happens. */
export interface CheckoutAnalytics {
  shippingInfo: (payload: ReturnType<typeof shippingInfoOf>) => void;
  paymentInfo: (payload: ReturnType<typeof paymentInfoOf>) => void;
  purchase: (payload: ReturnType<typeof purchaseOf>) => void;
}

/**
 * What the flow needs from the page around it. `placedMarker` remembers, in this tab only, that an order
 * was just placed, so a reload shows its confirmation without its number in the page address;
 * `cartChanged` tells the rest of the storefront (the header's cart) that the cart is gone.
 */
export interface CheckoutSurroundings {
  placedMarker: { has: () => boolean; set: () => void; clear: () => void };
  cartChanged: () => void;
}

const noSurroundings: CheckoutSurroundings = {
  placedMarker: { has: () => false, set: () => undefined, clear: () => undefined },
  cartChanged: () => undefined,
};

/**
 * The checkout of the visitor's active order, one step at a time. Every step writes to the order in
 * Vendure and reads it back, so what is shown is what Vendure holds.
 */
export const createCheckoutFlow = (call: CallAction, analytics: CheckoutAnalytics, surroundings: CheckoutSurroundings = noSurroundings) => {
  const state = ref<CheckoutState | null>(null);
  const status = ref<'loading' | 'ready' | 'unavailable'>('loading');
  const step = ref<CheckoutStep>('contact');
  const busy = ref(false);
  const problem = ref<CheckoutMessageKey | null>(null);
  /** The order just placed, or read back for the confirmation. */
  const placed = ref<CheckoutOrder | null>(null);

  const order = computed(() => state.value?.order ?? null);
  const isEmpty = computed(() => status.value === 'ready' && !order.value?.lines.length);
  /** The furthest step the order allows: every step before it is filled. */
  const furthest = computed<CheckoutStep>(() => (order.value ? firstOpenStep(order.value) : 'contact'));

  const readState = async () => {
    state.value = await call(VendureCheckoutGetStateAction);
  };

  /** The confirmation of the newest order placed in this browser; false when it cannot be read (any more). */
  const showPlaced = async (): Promise<boolean> => {
    try {
      placed.value = (await call(VendureCheckoutOrderByCodeAction, {})).order;
      return true;
    } catch {
      return false;
    }
  };

  const load = async () => {
    status.value = 'loading';
    try {
      await readState();
      if (order.value?.lines.length) surroundings.placedMarker.clear();
      // Only right after placing: a later visit with an empty cart is an empty cart, not an old order.
      else if (surroundings.placedMarker.has() && !(await showPlaced())) surroundings.placedMarker.clear();
      status.value = 'ready';
      step.value = furthest.value;
    } catch (error) {
      console.warn('[@laioutr/app-vendure] The checkout could not read the order:', error);
      status.value = 'unavailable';
    }
  };

  // One write at a time: a second press while the first is on its way (a double click, Enter twice) gets
  // the first one's answer instead of sending the order's writes, or a payment, again.
  let pending: Promise<boolean> | null = null;

  /** Runs a step's writes; a refusal becomes the step's problem, and a changed order is read again. */
  const run = (writes: () => Promise<void>): Promise<boolean> => {
    pending ??= (async () => {
      busy.value = true;
      problem.value = null;
      try {
        await writes();
        return true;
      } catch (error) {
        problem.value = checkoutProblemOf(error);
        if (problem.value === 'unknown') console.warn('[@laioutr/app-vendure] A checkout step failed:', error);
        if (needsReload(problem.value)) await readState().catch(() => undefined);
        return false;
      } finally {
        busy.value = false;
        pending = null;
      }
    })();
    return pending;
  };

  // Vendure fixes the order once it awaits payment; going back to change a step reopens it.
  const reopenOrder = async () => {
    if (order.value?.state === 'ArrangingPayment') await call(VendureCheckoutTransitionAction, { state: 'AddingItems' });
  };

  const advance = async () => {
    await readState();
    step.value = furthest.value;
  };

  /** Reads the order again after the cart changed elsewhere on the page, keeping the shopper on a step it still allows. */
  const refresh = async () => {
    if (status.value !== 'ready' || placed.value || pending) return;
    try {
      await readState();
    } catch (error) {
      console.warn('[@laioutr/app-vendure] The checkout could not read the changed order:', error);
      return;
    }
    if (!isStepReachable(step.value, furthest.value)) step.value = furthest.value;
  };

  const submitContact = (contact: ContactForm) =>
    run(async () => {
      await reopenOrder();
      await call(VendureCheckoutSetCustomerAction, trimmedContact(contact));
      await advance();
    });

  /** `billing` is null when it is the shipping address. */
  const submitAddress = (shipping: AddressForm, billing: AddressForm | null) =>
    run(async () => {
      await reopenOrder();
      const shippingAddress = toMailingAddress(shipping);
      await call(VendureCheckoutSetShippingAddressAction, { address: shippingAddress });
      await call(VendureCheckoutSetBillingAddressAction, { address: billing ? toMailingAddress(billing) : shippingAddress });
      await advance();
    });

  const submitDelivery = (shippingMethodId: string) =>
    run(async () => {
      await reopenOrder();
      await call(VendureCheckoutSetShippingMethodAction, { shippingMethodIds: [shippingMethodId] });
      await advance();
      const method = state.value?.shippingMethods.find((each) => each.id === shippingMethodId);
      if (order.value) analytics.shippingInfo(shippingInfoOf(order.value, method?.name));
    });

  /** Payment info is reported once per order and method: a retry after a decline submits nothing new. */
  const reportedPayments = new Set<string>();

  const placeOnce = async (paymentMethodCode: string): Promise<string | undefined> => {
    let code: string | undefined;
    await run(async () => {
      const before = order.value;
      if (!before) return;
      if (before.state !== 'ArrangingPayment') await call(VendureCheckoutTransitionAction, { state: 'ArrangingPayment' });
      const paymentType = state.value?.paymentMethods.find((method) => method.code === paymentMethodCode)?.name ?? paymentMethodCode;
      const paymentKey = `${before.id}:${paymentMethodCode}`;
      if (!reportedPayments.has(paymentKey)) {
        reportedPayments.add(paymentKey);
        analytics.paymentInfo(paymentInfoOf(before, paymentType));
      }
      const payment = await call(VendureCheckoutAddPaymentAction, { method: paymentMethodCode });
      code = payment.code;
      surroundings.placedMarker.set();
      // The order is placed; a failed read-back only costs the confirmation its details.
      placed.value = await call(VendureCheckoutOrderByCodeAction, { code: payment.code })
        .then((answer) => answer.order)
        .catch(() => ({ ...before, code: payment.code, state: payment.state }));
      analytics.purchase(purchaseOf(placed.value, paymentType));
      surroundings.cartChanged();
    });
    // A refused payment put the order back to adding items on the server; reading it keeps this step and
    // the cart in line with it, so the shopper can try again or change the cart.
    if (!code && problem.value) await readState().catch(() => undefined);
    return code;
  };

  let placing: Promise<string | undefined> | null = null;

  /** Answers the placed order's code, or nothing when the payment did not go through. */
  const placeOrder = (paymentMethodCode: string): Promise<string | undefined> =>
    (placing ??= placeOnce(paymentMethodCode).finally(() => (placing = null)));

  const openStep = (target: CheckoutStep) => {
    if (!isStepReachable(target, furthest.value)) return;
    problem.value = null;
    step.value = target;
  };

  return {
    state,
    order,
    status,
    step,
    furthest,
    busy,
    problem,
    placed,
    isEmpty,
    load,
    refresh,
    submitContact,
    submitAddress,
    submitDelivery,
    placeOrder,
    openStep,
  };
};

export type CheckoutFlow = ReturnType<typeof createCheckoutFlow>;
