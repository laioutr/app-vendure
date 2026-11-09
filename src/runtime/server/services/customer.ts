import { AddressNotFoundError, UnauthenticatedError } from '@laioutr-core/canonical-types/ecommerce';
import type { VendureClient } from '../client/VendureClient';
import type { MailingAddressValue } from '../mappers/address';
import type { CustomerFieldsFragment } from '../types/vendure.generated';
import { operations } from '../client/operations';
import { toCreateAddressInput, toUpdateAddressInput } from '../mappers/address';

/** The signed-in customer; without one, the visitor has to sign in. */
export const activeCustomerOf = async (client: VendureClient): Promise<CustomerFieldsFragment> => {
  const customer = client.hasSession ? (await client.request(operations.activeCustomer)).activeCustomer : null;
  if (!customer) throw new UnauthenticatedError();
  return customer;
};

/** One of the signed-in customer's addresses; an id that is not theirs is not found. */
const ownAddress = async (client: VendureClient, id: string) => {
  const address = (await activeCustomerOf(client)).addresses?.find((candidate) => candidate.id === id);
  if (!address) throw new AddressNotFoundError(id);
  return address;
};

export const updateCustomer = async (
  client: VendureClient,
  update: { firstName?: string; lastName?: string; salutation?: string; phone?: string; customFields?: Record<string, unknown> }
) => {
  await activeCustomerOf(client);
  await client.request(operations.updateCustomer, {
    input: {
      firstName: update.firstName,
      lastName: update.lastName,
      title: update.salutation,
      phoneNumber: update.phone,
      ...(update.customFields ? { customFields: update.customFields } : {}),
    },
  });
};

/**
 * Vendure confirms a new address by email when the shop requires verification and changes it at once
 * otherwise; the result does not say which, so the address is read back.
 */
export const changeEmail = async (client: VendureClient, email: string, currentPassword: string): Promise<'changed' | 'pending-confirmation'> => {
  await activeCustomerOf(client);
  await client.mutate(
    operations.requestUpdateCustomerEmailAddress,
    { password: currentPassword, newEmailAddress: email },
    'requestUpdateCustomerEmailAddress',
    { confirmsWithPassword: true }
  );
  const after = await activeCustomerOf(client);
  return after.emailAddress.toLowerCase() === email.toLowerCase() ? 'changed' : 'pending-confirmation';
};

export const changePassword = async (client: VendureClient, currentPassword: string, newPassword: string) => {
  await activeCustomerOf(client);
  await client.mutate(operations.updateCustomerPassword, { currentPassword, newPassword }, 'updateCustomerPassword', {
    confirmsWithPassword: true,
    passwordField: 'newPassword',
  });
};

export const createAddress = async (client: VendureClient, address: MailingAddressValue) => {
  await activeCustomerOf(client);
  await client.request(operations.createCustomerAddress, { input: toCreateAddressInput(address) });
};

export const updateAddress = async (client: VendureClient, id: string, update: Partial<MailingAddressValue>) => {
  const stored = await ownAddress(client, id);
  await client.request(operations.updateCustomerAddress, { input: toUpdateAddressInput(id, update, stored) }, { addressId: id });
};

export const deleteAddress = async (client: VendureClient, id: string) => {
  await ownAddress(client, id);
  await client.request(operations.deleteCustomerAddress, { id }, { addressId: id });
};

export const setDefaultAddress = async (client: VendureClient, id: string, type: 'shipping' | 'billing') => {
  await ownAddress(client, id);
  await client.request(
    operations.updateCustomerAddress,
    { input: { id, ...(type === 'shipping' ? { defaultShippingAddress: true } : { defaultBillingAddress: true }) } },
    { addressId: id }
  );
};
