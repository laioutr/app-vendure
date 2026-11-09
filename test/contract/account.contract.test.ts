import { describe, expect, it } from 'vitest';
import { visitor } from './client';
import {
  CustomerNotConfirmedError,
  InvalidCredentialsError,
  OrderNotFoundError,
  PasswordResetTokenInvalidError,
  UnauthenticatedError,
} from '@laioutr-core/canonical-types/ecommerce';
import { toCanonicalCustomer } from '../../src/runtime/server/mappers/customer';
import { login, logout, register, requestPasswordReset, resetPassword } from '../../src/runtime/server/services/auth';
import { addVariants, removeLine } from '../../src/runtime/server/services/cart';
import { addPayment, getCheckoutState, orderByCode, setShippingAddress, setShippingMethod, transitionOrder } from '../../src/runtime/server/services/checkout';
import { activeCustomerOf, createAddress, deleteAddress, setDefaultAddress, updateAddress } from '../../src/runtime/server/services/customer';
import { activeOrderOf, customerOrders, orderOfCustomer } from '../../src/runtime/server/services/order';

const PASSWORD = 'Contract-Test-1!';

describe('accounts against the Shop API', () => {
  it('registers; a shop that requires verification leaves the customer to confirm the email', async () => {
    const email = `laioutr-contract-${Date.now()}@example.com`;
    const shopper = visitor();
    const status = await register(shopper.client(), { email, password: PASSWORD, firstName: 'Contract', lastName: 'Test' });
    // The demo requires verification and sends no email anyone can read, so no account there signs in.
    expect(['pending-confirmation', 'signed-in']).toContain(status);
    if (status === 'pending-confirmation') await expect(login(shopper.client(), email, PASSWORD)).rejects.toBeInstanceOf(CustomerNotConfirmedError);
    await expect(login(shopper.client(), email, 'wrong-password')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('answers a recovery the same for any address, and refuses a made-up reset token', async () => {
    await requestPasswordReset(visitor().client(), `nobody-${Date.now()}@example.com`);
    await expect(resetPassword(visitor().client(), 'https://shop.example.com/password-reset?token=made-up', PASSWORD)).rejects.toBeInstanceOf(PasswordResetTokenInvalidError);
  });

  it('refuses the account to a visitor who is not signed in', async () => {
    await expect(activeCustomerOf(visitor().client())).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(customerOrders(visitor().client(), { skip: 0, take: 1 })).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  const email = process.env.VENDURE_CONTRACT_EMAIL;
  const password = process.env.VENDURE_CONTRACT_PASSWORD;

  describe.skipIf(!email || !password)('a verified customer', () => {
    it('signs in, keeps an address book, lists orders and signs out', async () => {
      const shopper = visitor();
      await login(shopper.client(), email!, password!);
      const customer = toCanonicalCustomer(await activeCustomerOf(shopper.client()));
      expect(customer.email).toBe(email);

      const address = { firstName: 'Contract', lastName: 'Test', address1: `Street ${Date.now()}`, city: 'Berlin', postalCode: '10115', countryCode: 'DE' };
      await createAddress(shopper.client(), address);
      const created = (await activeCustomerOf(shopper.client())).addresses!.find((entry) => entry.streetLine1 === address.address1)!;
      await updateAddress(shopper.client(), created.id, { city: 'Hamburg' });
      await setDefaultAddress(shopper.client(), created.id, 'billing');
      const updated = (await activeCustomerOf(shopper.client())).addresses!.find((entry) => entry.id === created.id)!;
      expect(updated).toMatchObject({ city: 'Hamburg', defaultBillingAddress: true });
      await deleteAddress(shopper.client(), created.id);

      expect((await customerOrders(shopper.client(), { skip: 0, take: 5 })).totalItems).toBeGreaterThanOrEqual(0);
      await logout(shopper.client());
    });

    it('reads its own order by code from another session, and orders it again', async () => {
      const shopper = visitor();
      await login(shopper.client(), email!, password!);
      await addVariants(shopper.client(), shopper.client(), [
        { productId: '1', variantId: '1', quantity: 1 },
        { productId: '1', variantId: '2', quantity: 2 },
      ]);
      const address = { firstName: 'Contract', lastName: 'Test', address1: 'Teststrasse 1', city: 'Berlin', postalCode: '10115', countryCode: 'DE' };
      await setShippingAddress(shopper.client(), address);
      const state = await getCheckoutState(shopper.client(), 'USD');
      await setShippingMethod(shopper.client(), [state.shippingMethods[0]!.id]);
      await transitionOrder(shopper.client(), 'ArrangingPayment');
      const payment = await addPayment(shopper.client(), state.paymentMethods.find((method) => method.isEligible)!.code, {});

      const sameCustomer = visitor();
      await login(sameCustomer.client(), email!, password!);
      const { order } = await orderByCode(sameCustomer.client(), payment.code, false);
      expect(order.lines).toHaveLength(2);
      await expect(orderByCode(visitor().client(), payment.code, false)).rejects.toBeInstanceOf(OrderNotFoundError);

      const placed = await orderOfCustomer(sameCustomer.client(), order.id);
      const again = await addVariants(
        sameCustomer.client(),
        sameCustomer.client(),
        placed!.lines.map((line) => ({ productId: line.productVariant.productId, variantId: line.productVariant.id, quantity: line.quantity }))
      );
      expect(again.map((outcome) => outcome.item.status)).toEqual(['added', 'added']);
      const cart = await activeOrderOf(sameCustomer.client());
      await Promise.all(cart!.lines.map((line) => removeLine(sameCustomer.client(), line.id)));
      await logout(sameCustomer.client());
    });
  });
});
