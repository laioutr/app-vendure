import { toAddressBookEntry, toE164 } from './address';
import type { CustomerFieldsFragment } from '../types/vendure.generated';

export const addressBookOf = (customer: Pick<CustomerFieldsFragment, 'addresses'>) =>
  (customer.addresses ?? []).flatMap((address) => {
    const entry = toAddressBookEntry(address);
    return entry ? [entry] : [];
  });

export const salutationKeyOf = (title: string | null | undefined) => title?.trim().toLowerCase().replace(/\.$/, '') || undefined;

export const toCanonicalCustomer = (customer: CustomerFieldsFragment) => {
  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress;
  return {
    id: customer.id,
    email: customer.emailAddress,
    phone: toE164(customer.phoneNumber),
    displayName,
    // Vendure's one `title` field holds a salutation ("Mr.", "Ms"), the canonical key is lowercase.
    person: { firstName: customer.firstName, lastName: customer.lastName, salutation: salutationKeyOf(customer.title) },
    addresses: addressBookOf(customer),
  };
};
