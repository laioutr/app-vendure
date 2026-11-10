import type { VendureCheckoutAddress, VendureCheckoutOrder } from '../../shared/tokens/checkout';
import type { CheckoutMessageKey } from '../i18n/messages';
import type { MailingAddress } from '@laioutr-core/canonical-types';
import type { z } from 'zod/v4';
import { toE164 } from '../../shared/phone';

export type CheckoutOrder = z.infer<typeof VendureCheckoutOrder>;
type OrderAddress = z.infer<typeof VendureCheckoutAddress>;

/** What a field's problem is, in the message's key; a field without a problem is absent. */
export type FieldProblems<Form> = Partial<Record<keyof Form, CheckoutMessageKey>>;

export interface ContactForm {
  email: string;
  firstName: string;
  lastName: string;
}

/** Every field as text, as the inputs hold it; empty is "not entered". */
export interface AddressForm {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  postalCode: string;
  city: string;
  provinceCode: string;
  countryCode: string;
  phone: string;
}

// The browser's own check (WHATWG `type=email`), so the form refuses what the inputs would.
const EMAIL = /^[\w.!#$%&'*+/=?^`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/i;

export const contactOf = (order: Pick<CheckoutOrder, 'customer'> | null | undefined): ContactForm => ({
  email: order?.customer?.email ?? '',
  firstName: order?.customer?.firstName ?? '',
  lastName: order?.customer?.lastName ?? '',
});

export const contactProblems = (form: ContactForm): FieldProblems<ContactForm> => {
  const problems: FieldProblems<ContactForm> = {};
  if (!form.email.trim()) problems.email = 'required';
  else if (!EMAIL.test(form.email.trim())) problems.email = 'invalidEmail';
  if (!form.firstName.trim()) problems.firstName = 'required';
  if (!form.lastName.trim()) problems.lastName = 'required';
  return problems;
};

export const trimmedContact = (form: ContactForm): ContactForm => ({
  email: form.email.trim(),
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
});

/**
 * The form for an address the order holds, filled where it is empty: with the contact's name, and
 * with the only country the shop delivers to.
 */
export const addressFormOf = (
  address: OrderAddress | undefined,
  contact: Pick<ContactForm, 'firstName' | 'lastName'>,
  countryCodes: readonly string[]
): AddressForm => ({
  firstName: address?.firstName ?? contact.firstName,
  lastName: address?.lastName ?? contact.lastName,
  company: address?.company ?? '',
  address1: address?.address1 ?? '',
  address2: address?.address2 ?? '',
  postalCode: address?.postalCode ?? '',
  city: address?.city ?? '',
  countryCode: address?.countryCode ?? (countryCodes.length === 1 ? countryCodes[0]! : ''),
  provinceCode: address?.provinceCode ?? '',
  phone: address?.phone ?? '',
});

const REQUIRED_ADDRESS_FIELDS = ['firstName', 'lastName', 'address1', 'postalCode', 'city', 'countryCode'] as const;

/** Whether an address the order holds has everything a delivery needs. */
export const isAddressComplete = (address: OrderAddress | undefined): boolean =>
  !!address && REQUIRED_ADDRESS_FIELDS.every((field) => !!address[field]?.trim());

export const addressProblems = (form: AddressForm, countryCodes: readonly string[]): FieldProblems<AddressForm> => {
  const problems: FieldProblems<AddressForm> = {};
  for (const field of REQUIRED_ADDRESS_FIELDS) if (!form[field].trim()) problems[field] = 'required';
  if (form.countryCode && !countryCodes.includes(form.countryCode)) problems.countryCode = 'invalidCountry';
  if (form.phone.trim() && !toE164(form.phone)) problems.phone = 'invalidPhone';
  return problems;
};

/** The address as the checkout actions take it: trimmed, empty optional fields left out. */
export const toMailingAddress = (form: AddressForm): z.infer<typeof MailingAddress> => {
  const optional = (value: string) => value.trim() || undefined;
  const address: z.infer<typeof MailingAddress> = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    address1: form.address1.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    countryCode: form.countryCode,
    company: optional(form.company),
    address2: optional(form.address2),
    provinceCode: optional(form.provinceCode),
    phone: toE164(form.phone),
  };
  return Object.fromEntries(Object.entries(address).filter(([, value]) => value !== undefined)) as typeof address;
};

/** The contact form's fields in the order the form shows them. */
export const CONTACT_FIELDS = Object.keys(contactOf(null)) as (keyof ContactForm)[];

/** The address form's fields in the order the form shows them. */
export const ADDRESS_FIELDS = Object.keys(addressFormOf(undefined, { firstName: '', lastName: '' }, [])) as (keyof AddressForm)[];

/** The first field, in the form's order, that has a problem; where the focus goes when a form is refused. */
export const firstProblemField = <Form>(problems: FieldProblems<Form>, fields: readonly (keyof Form)[]): keyof Form | undefined =>
  fields.find((field) => problems[field]);

/** Whether two addresses the order holds are the same, so billing is shown as "same as shipping". */
export const isSameAddress = (a: OrderAddress | undefined, b: OrderAddress | undefined): boolean =>
  ADDRESS_FIELDS.every((field) => (a?.[field] ?? '') === (b?.[field] ?? ''));

/** One line per part of an address, for a step's summary and the confirmation. */
export const addressLines = (address: OrderAddress | undefined, countryName: (code: string) => string): string[] => {
  if (!address) return [];
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.company,
    [address.address1, address.address2].filter(Boolean).join(', '),
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.countryCode ? countryName(address.countryCode) : undefined,
  ].filter((line): line is string => !!line);
};

/**
 * A country's name: the shop's own, else the browser's name for it in the page's language, else its
 * code. `Intl.DisplayNames` throws on a language tag it does not know.
 */
export const countryNameOf = (code: string, countries: readonly { code: string; name: string }[], languageTag: string): string => {
  const own = countries.find((country) => country.code === code)?.name;
  if (own) return own;
  try {
    return new Intl.DisplayNames([languageTag], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};
