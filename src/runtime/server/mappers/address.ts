import type { AddressFieldsFragment, CreateAddressInput, OrderAddressFieldsFragment, UpdateAddressInput } from '../types/vendure.generated';

/** The canonical mailing address, written out so this module needs no runtime import of the schema. */
export interface MailingAddressValue {
  firstName: string;
  lastName: string;
  salutation?: string;
  title?: string;
  company?: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  provinceCode?: string;
}

const E164 = /^\+?[1-9]\d{1,14}$/;

/** A phone number in the E.164 form the canonical schema takes, or nothing: Vendure stores free text. */
export const toE164 = (phone: string | null | undefined): string | undefined => {
  const compact = phone?.replace(/[\s\-().]/g, '');
  return compact && E164.test(compact) ? compact : undefined;
};

/** Vendure keeps one `fullName`; the first word is taken as the first name, the rest as the last. */
export const splitFullName = (fullName: string | null | undefined): { firstName: string; lastName: string } => {
  const [firstName = '', ...rest] = (fullName ?? '').trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
};

export const joinFullName = (address: Partial<Pick<MailingAddressValue, 'firstName' | 'lastName'>>) =>
  [address.firstName, address.lastName].filter(Boolean).join(' ');

type VendureAddress = Pick<OrderAddressFieldsFragment, 'fullName' | 'company' | 'streetLine1' | 'streetLine2' | 'city' | 'province' | 'postalCode' | 'phoneNumber'> & {
  countryCode?: string | null;
};

/** Every canonical field a Vendure address fills; an empty one is left out. */
const enteredFields = (address: VendureAddress): Partial<MailingAddressValue> => {
  const name = splitFullName(address.fullName);
  const fields: Partial<MailingAddressValue> = {
    firstName: name.firstName || undefined,
    lastName: name.lastName || undefined,
    company: address.company || undefined,
    phone: toE164(address.phoneNumber),
    address1: address.streetLine1 || undefined,
    address2: address.streetLine2 || undefined,
    city: address.city || undefined,
    postalCode: address.postalCode || undefined,
    countryCode: address.countryCode?.toUpperCase() || undefined,
    provinceCode: address.province || undefined,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
};

/**
 * A Vendure address as a canonical one. An address without a street or country is no address a
 * customer can be shown or shipped to, so it answers undefined.
 */
export const toMailingAddress = (address: VendureAddress | null | undefined): MailingAddressValue | undefined => {
  if (!address?.streetLine1 || !address.countryCode) return undefined;
  return {
    firstName: '',
    lastName: '',
    city: '',
    postalCode: '',
    ...enteredFields(address),
    address1: address.streetLine1,
    countryCode: address.countryCode.toUpperCase(),
  };
};

/**
 * The fields of an order address entered so far, during checkout: Vendure keeps a partial address as
 * it was sent. Undefined until a street or a name is entered.
 */
export const toPartialAddress = (address: VendureAddress | null | undefined): Partial<MailingAddressValue> | undefined =>
  address && (address.streetLine1 || address.fullName) ? enteredFields(address) : undefined;

export const toAddressBookEntry = (address: AddressFieldsFragment) => {
  const mailing = toMailingAddress({ ...address, countryCode: address.country.code });
  return mailing
    ? {
        id: address.id,
        address: mailing,
        isDefaultShipping: !!address.defaultShippingAddress,
        isDefaultBilling: !!address.defaultBillingAddress,
      }
    : undefined;
};

export const toCreateAddressInput = (address: MailingAddressValue): CreateAddressInput => ({
  fullName: joinFullName(address),
  company: address.company,
  streetLine1: address.address1,
  streetLine2: address.address2,
  city: address.city,
  province: address.provinceCode,
  postalCode: address.postalCode,
  countryCode: address.countryCode,
  phoneNumber: address.phone,
});

/** Canonical address fields and the Vendure fields they are written to; the name is handled apart. */
const UPDATE_FIELDS = {
  company: 'company',
  address1: 'streetLine1',
  address2: 'streetLine2',
  city: 'city',
  provinceCode: 'province',
  postalCode: 'postalCode',
  countryCode: 'countryCode',
  phone: 'phoneNumber',
} as const satisfies Partial<Record<keyof MailingAddressValue, keyof UpdateAddressInput>>;

/**
 * Only the fields the caller sent. A name sent half is completed from the stored address, since
 * Vendure keeps one `fullName`.
 */
export const toUpdateAddressInput = (id: string, update: Partial<MailingAddressValue>, stored: AddressFieldsFragment | undefined): UpdateAddressInput => {
  const storedName = splitFullName(stored?.fullName);
  const nameChanged = update.firstName !== undefined || update.lastName !== undefined;
  const input: UpdateAddressInput = { id };
  if (nameChanged) input.fullName = joinFullName({ firstName: update.firstName ?? storedName.firstName, lastName: update.lastName ?? storedName.lastName });
  for (const [field, vendureField] of Object.entries(UPDATE_FIELDS) as [keyof typeof UPDATE_FIELDS, (typeof UPDATE_FIELDS)[keyof typeof UPDATE_FIELDS]][]) {
    const value = update[field];
    if (value !== undefined) input[vendureField] = value;
  }
  return input;
};
