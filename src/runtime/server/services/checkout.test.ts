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
    expect(await getCheckoutState(client(), 'USD')).toMatchObject({ order: null, shippingMethods: [] });
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

  it("answers the placed order's code, and a declined payment as its reason", async () => {
    fakeShopApi({ AddPaymentToOrder: { data: { addPaymentToOrder: { __typename: 'Order', code: 'C1', state: 'PaymentAuthorized' } } } });
    expect(await addPayment(client('t'), 'card', undefined)).toEqual({ code: 'C1', state: 'PaymentAuthorized' });

    fakeShopApi({
      AddPaymentToOrder: {
        data: {
          addPaymentToOrder: {
            __typename: 'PaymentDeclinedError',
            errorCode: 'PAYMENT_DECLINED_ERROR',
            message: 'm',
            paymentErrorMessage: 'card declined',
          },
        },
      },
    });
    const declined = await addPayment(client('t'), 'card', {}).catch((error: unknown) => error);
    expect(declined).toBeInstanceOf(VendureOrderError);
    expect(declined).toMatchObject({ data: { reason: 'payment-declined' } });
  });
});
