import { describe, expect, it, vi } from 'vitest';
import { createCheckoutFlow } from './checkoutFlow';
import type { CallAction, CheckoutState } from './checkoutFlow';
import { checkoutOrder } from '../../../../test/fixtures/checkout';
import { VendureOrderError } from '../../shared/errors';
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

const address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: '',
  address1: 'Main St 1',
  address2: '',
  postalCode: '10115',
  city: 'Berlin',
  provinceCode: '',
  countryCode: 'DE',
  phone: '',
};
const customer = { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' };
const shipped = { firstName: 'Ada', lastName: 'Lovelace', address1: 'Main St 1', postalCode: '10115', city: 'Berlin', countryCode: 'DE' };

/**
 * A Vendure that keeps what each step sets on one order, as the Shop API does, and answers every call
 * through the actions the section uses. `refuse` makes one action fail with the error given.
 */
const fakeShop = (refuse: Partial<Record<string, unknown>> = {}) => {
  let order = checkoutOrder();
  const calls: { token: string; input: unknown }[] = [];
  /** Answers held back until the test lets them go, to send a second call while the first is on its way. */
  const held: Partial<Record<string, Promise<void>>> = {};
  const state = (): CheckoutState => ({
    order,
    shippingMethods: [{ id: 's1', code: 'std', name: 'Standard', price: { amount: 500, currency: 'USD' } }],
    paymentMethods: [{ code: 'standard-payment', name: 'Standard Payment', isEligible: true, completesHere: true }],
    nextStates: [],
    countries: [{ code: 'DE', name: 'Germany' }],
  });
  const call = (async (token: string, input?: any) => {
    calls.push({ token, input });
    await held[token];
    if (refuse[token]) throw refuse[token];
    switch (token) {
      case VendureCheckoutGetStateAction:
        return state();
      case VendureCheckoutSetCustomerAction:
        order = { ...order, customer: { email: input.email, firstName: input.firstName, lastName: input.lastName } };
        return undefined;
      case VendureCheckoutSetShippingAddressAction:
        order = { ...order, shippingAddress: input.address };
        return undefined;
      case VendureCheckoutSetBillingAddressAction:
        order = { ...order, billingAddress: input.address };
        return undefined;
      case VendureCheckoutSetShippingMethodAction:
        order = { ...order, shippingMethodIds: input.shippingMethodIds };
        return undefined;
      case VendureCheckoutTransitionAction:
        order = { ...order, state: input.state };
        return { state: input.state };
      case VendureCheckoutAddPaymentAction: {
        const placedOrder = { ...order, state: 'PaymentAuthorized' };
        placedOrders.push(placedOrder);
        order = checkoutOrder({ lines: [] });
        return { code: placedOrder.code, state: placedOrder.state };
      }
      case VendureCheckoutOrderByCodeAction: {
        const found = input.code ? placedOrders.find((each) => each.code === input.code) : placedOrders.at(-1);
        if (!found) throw new Error('not found');
        return { order: found };
      }
      default:
        throw new Error(`The fake shop does not answer ${token}`);
    }
  }) as CallAction;
  const placedOrders: (typeof order)[] = [];
  const hold = (token: string) => {
    let release!: () => void;
    held[token] = new Promise((resolve) => (release = resolve));
    return () => {
      delete held[token];
      release();
    };
  };
  return {
    call,
    calls,
    hold,
    placedOrders,
    tokens: () => calls.map((each) => each.token),
    count: (token: string) => calls.filter((each) => each.token === token).length,
    setOrder: (next: typeof order) => (order = next),
  };
};

/** A tab's memory of a placed order, as session storage keeps it. */
const marker = (initially = false) => {
  let value = initially;
  return { has: () => value, set: () => (value = true), clear: () => (value = false) };
};

const analytics = () => ({ shippingInfo: vi.fn(), paymentInfo: vi.fn(), purchase: vi.fn() });

describe('createCheckoutFlow', () => {
  it('walks a guest from contact to a placed order, reporting delivery, payment and purchase', async () => {
    const shop = fakeShop();
    const events = analytics();
    const flow = createCheckoutFlow(shop.call, events);

    await flow.load();
    expect(flow.status.value).toBe('ready');
    expect(flow.step.value).toBe('contact');

    expect(await flow.submitContact({ email: ' ada@example.com ', firstName: 'Ada', lastName: 'Lovelace' })).toBe(true);
    expect(shop.calls.find((each) => each.token === VendureCheckoutSetCustomerAction)?.input).toEqual(customer);
    expect(flow.step.value).toBe('address');

    expect(await flow.submitAddress(address, null)).toBe(true);
    // Billing follows shipping while the shopper keeps them the same.
    const billing = shop.calls.find((each) => each.token === VendureCheckoutSetBillingAddressAction)?.input;
    expect(billing).toEqual({ address: shipped });
    expect(flow.step.value).toBe('delivery');

    expect(await flow.submitDelivery('s1')).toBe(true);
    expect(flow.step.value).toBe('payment');
    expect(events.shippingInfo).toHaveBeenCalledWith(expect.objectContaining({ shippingTier: 'Standard' }));

    expect(await flow.placeOrder('standard-payment')).toBe('ABC');
    expect(shop.tokens().slice(-3)).toEqual([
      VendureCheckoutTransitionAction,
      VendureCheckoutAddPaymentAction,
      VendureCheckoutOrderByCodeAction,
    ]);
    expect(events.paymentInfo).toHaveBeenCalledWith(expect.objectContaining({ paymentType: 'Standard Payment' }));
    // Once: a purchase reported twice counts the revenue twice.
    expect(events.purchase).toHaveBeenCalledOnce();
    expect(events.purchase).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ABC', paymentType: 'Standard Payment' }));
    expect(flow.placed.value?.state).toBe('PaymentAuthorized');
  });

  it('opens where a returning shopper left off, and reopens an order awaiting payment to change a step', async () => {
    const shop = fakeShop();
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'], state: 'ArrangingPayment' }));
    const flow = createCheckoutFlow(shop.call, analytics());
    await flow.load();
    expect(flow.step.value).toBe('payment');

    flow.openStep('address');
    expect(flow.step.value).toBe('address');
    await flow.submitAddress(address, { ...address, city: 'Hamburg' });
    const [reopen] = shop.calls.filter((each) => each.token === VendureCheckoutTransitionAction);
    expect(reopen?.input).toEqual({ state: 'AddingItems' });
    expect(shop.calls.find((each) => each.token === VendureCheckoutSetBillingAddressAction)?.input).toEqual({
      address: { ...shipped, city: 'Hamburg' },
    });
  });

  it('keeps the shopper on the step with the words for a refusal, and places nothing on a declined payment', async () => {
    const shop = fakeShop({ [VendureCheckoutAddPaymentAction]: new VendureOrderError('payment-declined') });
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'] }));
    const events = analytics();
    const flow = createCheckoutFlow(shop.call, events);
    await flow.load();

    expect(await flow.placeOrder('standard-payment')).toBeUndefined();
    expect(flow.problem.value).toBe('paymentDeclined');
    // The server put the order back to adding items; the flow reads that, so the cart can change.
    expect(shop.tokens().at(-1)).toBe(VendureCheckoutGetStateAction);
    expect(flow.placed.value).toBeNull();
    expect(flow.step.value).toBe('payment');
    expect(events.purchase).not.toHaveBeenCalled();
    expect(flow.busy.value).toBe(false);
  });

  it('does not open a step whose earlier steps are empty', async () => {
    const flow = createCheckoutFlow(fakeShop().call, analytics());
    await flow.load();
    flow.openStep('payment');
    expect(flow.step.value).toBe('contact');
  });

  it('says the checkout is unavailable when the order cannot be read, and shows an empty cart as empty', async () => {
    const down = createCheckoutFlow(fakeShop({ [VendureCheckoutGetStateAction]: new TypeError('Failed to fetch') }).call, analytics());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await down.load();
    expect(down.status.value).toBe('unavailable');

    const shop = fakeShop();
    shop.setOrder(checkoutOrder({ lines: [] }));
    const empty = createCheckoutFlow(shop.call, analytics());
    await empty.load();
    expect(empty.isEmpty.value).toBe(true);
  });

  it('shows the order placed in this tab after a reload, and an empty cart once that order cannot be read', async () => {
    const shop = fakeShop();
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'] }));
    const tab = marker();
    const cartChanged = vi.fn();
    const placing = createCheckoutFlow(shop.call, analytics(), { placedMarker: tab, cartChanged });
    await placing.load();
    await placing.placeOrder('standard-payment');
    expect(tab.has()).toBe(true);
    // The header's cart is told once, after the order is placed.
    expect(cartChanged).toHaveBeenCalledOnce();

    const reloaded = createCheckoutFlow(shop.call, analytics(), { placedMarker: tab, cartChanged: vi.fn() });
    await reloaded.load();
    expect(reloaded.placed.value?.code).toBe('ABC');
    // Read as "the newest placed here": no order number travels from the page.
    expect(shop.calls.at(-1)).toEqual({ token: VendureCheckoutOrderByCodeAction, input: {} });

    const later = createCheckoutFlow(fakeShop({ [VendureCheckoutOrderByCodeAction]: new Error('not found') }).call, analytics(), {
      placedMarker: tab,
      cartChanged: vi.fn(),
    });
    await later.load();
    expect(later.placed.value).toBeNull();
    expect(tab.has()).toBe(false);
  });

  it('forgets a placed order once the cart has lines again', async () => {
    const tab = marker(true);
    const flow = createCheckoutFlow(fakeShop().call, analytics(), { placedMarker: tab, cartChanged: vi.fn() });
    await flow.load();
    expect(flow.placed.value).toBeNull();
    expect(tab.has()).toBe(false);
  });

  it('places an order once, however often Place order is pressed while it is on its way', async () => {
    const shop = fakeShop();
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'] }));
    const events = analytics();
    const flow = createCheckoutFlow(shop.call, events);
    await flow.load();

    const release = shop.hold(VendureCheckoutTransitionAction);
    const first = flow.placeOrder('standard-payment');
    const second = flow.placeOrder('standard-payment');
    expect(second).toBe(first);
    expect(flow.busy.value).toBe(true);
    release();
    expect(await second).toBe('ABC');

    expect(shop.count(VendureCheckoutTransitionAction)).toBe(1);
    expect(shop.count(VendureCheckoutAddPaymentAction)).toBe(1);
    expect(events.paymentInfo).toHaveBeenCalledOnce();
    expect(events.purchase).toHaveBeenCalledOnce();
  });

  it('sends a step once while it is on its way', async () => {
    const shop = fakeShop();
    const flow = createCheckoutFlow(shop.call, analytics());
    await flow.load();
    const release = shop.hold(VendureCheckoutSetCustomerAction);
    const contact = { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' };
    const first = flow.submitContact(contact);
    expect(flow.submitContact(contact)).toBe(first);
    release();
    expect(await first).toBe(true);
    expect(shop.count(VendureCheckoutSetCustomerAction)).toBe(1);
  });

  it('reports payment info once per order and method, not on every retry after a decline', async () => {
    const shop = fakeShop({ [VendureCheckoutAddPaymentAction]: new VendureOrderError('payment-declined') });
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'] }));
    const events = analytics();
    const flow = createCheckoutFlow(shop.call, events);
    await flow.load();
    await flow.placeOrder('standard-payment');
    await flow.placeOrder('standard-payment');
    expect(events.paymentInfo).toHaveBeenCalledOnce();
  });

  it('reads the order again when the cart changes elsewhere, and goes back to a step the order allows', async () => {
    const shop = fakeShop();
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'] }));
    const flow = createCheckoutFlow(shop.call, analytics());
    await flow.load();
    expect(flow.step.value).toBe('payment');

    // The cart sheet changed a quantity, which also dropped the shipping method in this shop.
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, total: { amount: 9999, currency: 'USD' } }));
    await flow.refresh();
    expect(flow.order.value?.total.amount).toBe(9999);
    expect(flow.step.value).toBe('delivery');

    shop.setOrder(checkoutOrder({ lines: [] }));
    await flow.refresh();
    expect(flow.isEmpty.value).toBe(true);
  });

  it('leaves a placed order and a write on its way alone when the cart changes', async () => {
    const shop = fakeShop();
    shop.setOrder(checkoutOrder({ customer, shippingAddress: shipped, shippingMethodIds: ['s1'] }));
    const flow = createCheckoutFlow(shop.call, analytics());
    await flow.load();
    await flow.placeOrder('standard-payment');
    const reads = shop.count(VendureCheckoutGetStateAction);
    await flow.refresh();
    expect(shop.count(VendureCheckoutGetStateAction)).toBe(reads);
  });
});
