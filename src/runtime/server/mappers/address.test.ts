import { describe, expect, it } from 'vitest';
import { splitFullName, toAddressBookEntry, toCreateAddressInput, toE164, toMailingAddress, toUpdateAddressInput } from './address';

const stored = {
  id: 'a1',
  fullName: 'Ada Byron Lovelace',
  company: null,
  streetLine1: 'Main St 1',
  streetLine2: '',
  city: 'London',
  province: null,
  postalCode: 'N1',
  country: { code: 'gb' },
  phoneNumber: '+44 20 7946 0000',
  defaultShippingAddress: true,
  defaultBillingAddress: false,
};

describe('address', () => {
  it('splits a full name at its first word', () => {
    expect(splitFullName('Ada Byron Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Byron Lovelace' });
    expect(splitFullName(null)).toEqual({ firstName: '', lastName: '' });
  });

  it('keeps a phone number only in E.164 form', () => {
    expect(toE164('+44 20 7946 0000')).toBe('+442079460000');
    expect(toE164('call me')).toBeUndefined();
  });

  it('maps a stored address to an address book entry', () => {
    expect(toAddressBookEntry(stored)).toEqual({
      id: 'a1',
      address: { firstName: 'Ada', lastName: 'Byron Lovelace', company: undefined, phone: '+442079460000', address1: 'Main St 1', address2: undefined, city: 'London', postalCode: 'N1', countryCode: 'GB', provinceCode: undefined },
      isDefaultShipping: true,
      isDefaultBilling: false,
    });
  });

  it('answers no address without a street or a country', () => {
    expect(toMailingAddress({ ...stored, streetLine1: '', countryCode: 'GB' })).toBeUndefined();
    expect(toMailingAddress({ ...stored, countryCode: null })).toBeUndefined();
  });

  it('writes a canonical address as Vendure input', () => {
    expect(toCreateAddressInput({ firstName: 'Ada', lastName: 'Lovelace', address1: 'Main St 1', city: 'London', postalCode: 'N1', countryCode: 'GB' })).toEqual({
      fullName: 'Ada Lovelace',
      company: undefined,
      streetLine1: 'Main St 1',
      streetLine2: undefined,
      city: 'London',
      province: undefined,
      postalCode: 'N1',
      countryCode: 'GB',
      phoneNumber: undefined,
    });
  });

  it('updates only what was sent, completing a half name from the stored one', () => {
    expect(toUpdateAddressInput('a1', { lastName: 'King' }, stored)).toEqual({ id: 'a1', fullName: 'Ada King' });
    expect(toUpdateAddressInput('a1', { city: 'Paris' }, stored)).toEqual({ id: 'a1', city: 'Paris' });
  });
});
