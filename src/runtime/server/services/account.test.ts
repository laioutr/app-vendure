import { afterEach, describe, expect, it, vi } from 'vitest';
import { logout, register } from './auth';
import { changeEmail, updateAddress } from './customer';
import { customerOrders, customerOrdersByIds, customerOrdersOfYear } from './order';
import { AddressNotFoundError, EmailAlreadyInUseError, UnauthenticatedError } from '@laioutr-core/canonical-types/ecommerce';
import { fakeShopApi } from '../../../../test/fixtures/fakeShopApi';
import { order } from '../../../../test/fixtures/vendure';
import { VendureClient } from '../client/VendureClient';
import { VendureApiError } from '../errors/mapVendureError';

const client = (sessionToken?: string) => new VendureClient({ apiUrl: 'https://shop.example.com/shop-api', sessionToken });
const registered = { data: { registerCustomerAccount: { __typename: 'Success' } } };
const registration = { email: 'a@example.com', password: 'secret', firstName: 'A', lastName: 'B' };
const customer = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: null,
  firstName: 'A',
  lastName: 'B',
  emailAddress: 'a@example.com',
  phoneNumber: null,
  addresses: [],
  ...overrides,
});

describe('register', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['CurrentUser', 'signed-in'],
    ['NotVerifiedError', 'pending-confirmation'],
  ])('tells the outcome from the sign-in that follows: %s', async (typename, outcome) => {
    fakeShopApi({ RegisterCustomerAccount: registered, Login: { data: { login: { __typename: typename } } } });
    expect(await register(client(), registration)).toBe(outcome);
  });

  it('answers an address that has an account with another password as already in use', async () => {
    fakeShopApi({
      RegisterCustomerAccount: registered,
      Login: { data: { login: { __typename: 'InvalidCredentialsError', errorCode: 'INVALID_CREDENTIALS_ERROR', message: 'm' } } },
    });
    await expect(register(client(), registration)).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });
});

describe('logout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forgets the session even when Vendure cannot end it', async () => {
    fakeShopApi({ Logout: { status: 503 } });
    const signedIn = client('t');
    await expect(logout(signedIn)).rejects.toBeInstanceOf(VendureApiError);
    expect(signedIn.hasSession).toBe(false);
  });
});

describe('customer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the address back to tell a change made at once from one waiting for confirmation', async () => {
    let reads = 0;
    const answerAfterChange = (email: string) => () => ({
      data: { activeCustomer: customer({ emailAddress: reads++ === 0 ? 'a@example.com' : email }) },
    });
    fakeShopApi({
      ActiveCustomer: answerAfterChange('b@example.com'),
      RequestUpdateCustomerEmailAddress: { data: { requestUpdateCustomerEmailAddress: { __typename: 'Success' } } },
    });
    expect(await changeEmail(client('t'), 'B@example.com', 'pw')).toBe('changed');

    reads = 0;
    fakeShopApi({
      ActiveCustomer: answerAfterChange('a@example.com'),
      RequestUpdateCustomerEmailAddress: { data: { requestUpdateCustomerEmailAddress: { __typename: 'Success' } } },
    });
    expect(await changeEmail(client('t'), 'b@example.com', 'pw')).toBe('pending-confirmation');
  });

  it("refuses an address that is not the customer's without changing it", async () => {
    const api = fakeShopApi({ ActiveCustomer: { data: { activeCustomer: customer() } } });
    await expect(updateAddress(client('t'), 'not-mine', { city: 'X' })).rejects.toBeInstanceOf(AddressNotFoundError);
    expect(api.operations()).toEqual(['ActiveCustomer']);
  });
});

describe('orders', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads a year page by page and stops at the total', async () => {
    const page = (count: number, total: number) => ({
      data: {
        activeCustomer: {
          id: 'c1',
          orders: { totalItems: total, items: Array.from({ length: count }, (_, index) => order({ id: `o${index}` })) },
        },
      },
    });
    let call = 0;
    const api = fakeShopApi({ CustomerOrders: () => (call++ === 0 ? page(100, 130) : page(30, 130)) });
    expect(await customerOrdersOfYear(client('t'), 2026)).toHaveLength(130);
    expect(api.calls).toHaveLength(2);
    expect(api.calls[0]!.variables).toMatchObject({
      options: { filter: { orderPlacedAt: { between: { start: '2026-01-01T00:00:00.000Z' } } } },
    });
  });

  it('reads any number of orders by id in one call per hundred', async () => {
    const api = fakeShopApi({
      CustomerOrders: ({ variables }) => {
        const ids = (variables!.options as { filter: { id: { in: string[] } } }).filter.id.in;
        return { data: { activeCustomer: { id: 'c1', orders: { totalItems: ids.length, items: ids.map((id) => order({ id })) } } } };
      },
    });
    const ids = Array.from({ length: 30 }, (_, index) => `o${index}`);
    expect(await customerOrdersByIds(client('t'), ids)).toHaveLength(30);
    expect(api.calls).toHaveLength(1);
  });

  it('caps a page at the hundred the Shop API answers', async () => {
    const api = fakeShopApi({ CustomerOrders: { data: { activeCustomer: { id: 'c1', orders: { totalItems: 0, items: [] } } } } });
    await customerOrders(client('t'), { skip: 0, take: 500 });
    expect(api.calls[0]!.variables).toMatchObject({ options: { take: 100, filter: { active: { eq: false } } } });
  });

  it('refuses a visitor who is not signed in', async () => {
    const api = fakeShopApi({ CustomerOrders: { data: { activeCustomer: null } } });
    await expect(customerOrdersOfYear(client(), 2026)).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(customerOrdersByIds(client('t'), ['o1'])).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(api.calls).toHaveLength(1);
  });
});
