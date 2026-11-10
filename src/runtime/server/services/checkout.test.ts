import { afterEach, describe, expect, it, vi } from 'vitest';
import { addPayment, getCheckoutState, orderByCode, transitionOrder } from './checkout';
import { OrderNotFoundError } from '@laioutr-core/canonical-types/ecommerce';
import { fakeShopApi, forbidden } from '../../../../test/fixtures/fakeShopApi';
import { order } from '../../../../test/fixtures/vendure';
import { VendureOrderError } from '../../shared/errors';
import { VendureClient } from '../client/VendureClient';

const client = (sessionToken?: string) => new VendureClient({ apiUrl: 'https://shop.example.com/shop-api', sessionToken });

const guestOrder = order({
  code: 'GUEST1',
  customer: { id: 'c-guest', firstName: 'G', lastName: 'Uest', emailAddress: 'guest@example.com' },
});

describe('orderByCode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers the browser that placed the order, with or without a session', async () => {
    fakeShopApi({ OrderByCode: { data: { activeCustomer: null, orderByCode: guestOrder } } });
    expect((await orderByCode(client(), 'GUEST1', true)).order.code).toBe('GUEST1');
    expect((await orderByCode(client('t'), 'GUEST1', true)).order.code).toBe('GUEST1');
  });

  it('refuses a guest order to another session, though Vendure answers it', async () => {
    fakeShopApi({ OrderByCode: { data: { activeCustomer: null, orderByCode: guestOrder } } });
    await expect(orderByCode(client('someone-else'), 'GUEST1', false)).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('refuses a visitor without a session without asking Vendure', async () => {
    const api = fakeShopApi({});
    await expect(orderByCode(client(), 'GUEST1', false)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(api.calls).toHaveLength(0);
  });

  it("answers the signed-in customer their own order, and no one else's", async () => {
    fakeShopApi({ OrderByCode: { data: { activeCustomer: { id: 'c-guest' }, orderByCode: guestOrder } } });
    expect((await orderByCode(client('t'), 'GUEST1', false)).order.code).toBe('GUEST1');
    fakeShopApi({ OrderByCode: { data: { activeCustomer: { id: 'c-other' }, orderByCode: guestOrder } } });
    await expect(orderByCode(client('t'), 'GUEST1', false)).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('answers an unknown or expired code as not found, not as a lost session', async () => {
    fakeShopApi({ OrderByCode: forbidden });
    await expect(orderByCode(client('t'), 'NOPE', true)).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe('checkout steps', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks nothing for a visitor without a session', async () => {
    const api = fakeShopApi({});
    expect(await getCheckoutState(client(), 'USD', [])).toMatchObject({ order: null, shippingMethods: [] });
    expect(api.calls).toHaveLength(0);
  });

  it('tells a missing order from one not ready to move', async () => {
    fakeShopApi({ TransitionOrderToState: { data: { transitionOrderToState: null } } });
    await expect(transitionOrder(client('t'), 'ArrangingPayment')).rejects.toMatchObject({ data: { reason: 'no-active-order' } });

    vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
    fakeShopApi({
      TransitionOrderToState: {
        data: {
          transitionOrderToState: {
            __typename: 'OrderStateTransitionError',
            errorCode: 'ORDER_STATE_TRANSITION_ERROR',
            message: 'm',
            transitionError: 'no customer',
          },
        },
      },
    });
    await expect(transitionOrder(client('t'), 'ArrangingPayment')).rejects.toMatchObject({ data: { reason: 'order-not-ready' } });
    fakeShopApi({ TransitionOrderToState: { data: { transitionOrderToState: { __typename: 'Order', errorCode: undefined } } } });
    expect(await transitionOrder(client('t'), 'ArrangingPayment')).toEqual({ state: 'ArrangingPayment' });
  });

  const awaitingPayment = { data: { activeOrder: { state: 'ArrangingPayment', payments: [] } } };
  const placedAnswer = { data: { addPaymentToOrder: { __typename: 'Order', code: 'C1', state: 'PaymentAuthorized' } } };
  const declinedAnswer = {
    data: {
      addPaymentToOrder: {
        __typename: 'PaymentDeclinedError',
        errorCode: 'PAYMENT_DECLINED_ERROR',
        message: 'm',
        paymentErrorMessage: 'card declined',
      },
    },
  };

  it("answers the placed order's code", async () => {
    fakeShopApi({ ActiveOrderPaymentState: awaitingPayment, AddPaymentToOrder: placedAnswer });
    expect(await addPayment(client('t'), 'card', undefined, [])).toEqual({ code: 'C1', state: 'PaymentAuthorized' });
  });

  it('puts the order back to adding items when the payment is declined, and answers the reason', async () => {
    const api = fakeShopApi({
      ActiveOrderPaymentState: awaitingPayment,
      AddPaymentToOrder: declinedAnswer,
      TransitionOrderToState: { data: { transitionOrderToState: { __typename: 'Order' } } },
    });
    const declined = await addPayment(client('t'), 'card', {}, []).catch((error: unknown) => error);
    expect(declined).toBeInstanceOf(VendureOrderError);
    expect(declined).toMatchObject({ data: { reason: 'payment-declined' } });
    expect(api.operations()).toEqual(['ActiveOrderPaymentState', 'AddPaymentToOrder', 'TransitionOrderToState']);
    expect(api.calls.at(-1)?.variables).toEqual({ state: 'AddingItems' });
  });

  it('refuses a second payment, and an order not awaiting payment, without reaching the payment handler', async () => {
    for (const activeOrder of [
      { state: 'ArrangingPayment', payments: [{ state: 'Declined' }, { state: 'Authorized' }] },
      { state: 'ArrangingPayment', payments: [{ state: 'Settled' }] },
      { state: 'AddingItems', payments: [] },
    ]) {
      const api = fakeShopApi({ ActiveOrderPaymentState: { data: { activeOrder } } });
      await expect(addPayment(client('t'), 'card', undefined, [])).rejects.toMatchObject({
        data: { reason: 'order-not-awaiting-payment' },
      });
      expect(api.operations()).toEqual(['ActiveOrderPaymentState']);
    }
    fakeShopApi({ ActiveOrderPaymentState: { data: { activeOrder: null } } });
    await expect(addPayment(client('t'), 'card', undefined, [])).rejects.toMatchObject({ data: { reason: 'no-active-order' } });
  });

  it("refuses a method paid in a provider's own flow without asking Vendure", async () => {
    const api = fakeShopApi({});
    await expect(addPayment(client('t'), 'stripe', undefined, ['stripe'])).rejects.toMatchObject({
      data: { reason: 'payment-method-not-eligible' },
    });
    expect(api.calls).toHaveLength(0);
  });
});
