import { describe, expect, it } from 'vitest';
import {
  ADDRESS_FIELDS,
  addressFormOf,
  addressLines,
  addressProblems,
  CONTACT_FIELDS,
  contactOf,
  contactProblems,
  countryNameOf,
  firstProblemField,
  isAddressComplete,
  isSameAddress,
  toMailingAddress,
  trimmedContact,
} from './checkoutForms';
import type { AddressForm } from './checkoutForms';

const filled = {
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

describe('contact', () => {
  it('starts from the order and asks for every field, the email well-formed', () => {
    expect(contactOf({ customer: { email: 'a@b.de', firstName: 'A', lastName: 'B' } })).toEqual({
      email: 'a@b.de',
      firstName: 'A',
      lastName: 'B',
    });
    expect(contactProblems({ email: '', firstName: ' ', lastName: 'B' })).toEqual({ email: 'required', firstName: 'required' });
    expect(contactProblems({ email: 'not-an-address', firstName: 'A', lastName: 'B' })).toEqual({ email: 'invalidEmail' });
    expect(contactProblems({ email: ' ada@example.com ', firstName: 'A', lastName: 'B' })).toEqual({});
    expect(trimmedContact({ email: ' ada@example.com ', firstName: ' A', lastName: 'B ' })).toEqual({
      email: 'ada@example.com',
      firstName: 'A',
      lastName: 'B',
    });
  });
});

describe('address', () => {
  it("fills an empty form with the contact's name and the shop's only country", () => {
    expect(addressFormOf(undefined, { firstName: 'Ada', lastName: 'L' }, ['DE'])).toMatchObject({
      firstName: 'Ada',
      lastName: 'L',
      countryCode: 'DE',
    });
    expect(addressFormOf(undefined, { firstName: '', lastName: '' }, ['DE', 'AT']).countryCode).toBe('');
    expect(addressFormOf({ city: 'Wien', countryCode: 'AT' }, { firstName: 'Ada', lastName: 'L' }, ['DE'])).toMatchObject({
      city: 'Wien',
      countryCode: 'AT',
    });
  });

  it('asks for what a delivery needs, a country the shop delivers to and a phone it can read', () => {
    expect(addressProblems(filled, ['DE'])).toEqual({});
    expect(addressProblems({ ...filled, city: ' ', countryCode: 'FR', phone: 'call me' }, ['DE'])).toEqual({
      city: 'required',
      countryCode: 'invalidCountry',
      phone: 'invalidPhone',
    });
  });

  it('sends the address trimmed, without empty optional fields, the phone in E.164', () => {
    expect(toMailingAddress({ ...filled, city: ' Berlin ', phone: '+49 30 123-4567' })).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      address1: 'Main St 1',
      city: 'Berlin',
      postalCode: '10115',
      countryCode: 'DE',
      phone: '+49301234567',
    });
  });

  it('tells a complete address and two equal ones', () => {
    const complete = toMailingAddress(filled);
    expect(isAddressComplete(complete)).toBe(true);
    expect(isAddressComplete({ ...complete, postalCode: '' })).toBe(false);
    expect(isAddressComplete(undefined)).toBe(false);
    expect(isSameAddress(complete, { ...complete })).toBe(true);
    expect(isSameAddress(complete, { ...complete, city: 'Wien' })).toBe(false);
  });

  it('writes an address as lines, with the country by name', () => {
    expect(addressLines(toMailingAddress({ ...filled, company: 'ACME' }), () => 'Germany')).toEqual([
      'Ada Lovelace',
      'ACME',
      'Main St 1',
      '10115 Berlin',
      'Germany',
    ]);
    expect(addressLines(undefined, () => '')).toEqual([]);
  });

  it("names a country by the shop's list, else the browser's, else its code", () => {
    expect(countryNameOf('DE', [{ code: 'DE', name: 'Deutschland' }], 'en')).toBe('Deutschland');
    expect(countryNameOf('DE', [], 'en')).toBe('Germany');
    expect(countryNameOf('DE', [], 'not a tag!')).toBe('DE');
  });
});

describe('firstProblemField', () => {
  it('finds the first refused field in the order the form shows them, where the focus goes', () => {
    expect(firstProblemField(contactProblems({ email: '', firstName: '', lastName: 'L' }), CONTACT_FIELDS)).toBe('email');
    const problems = addressProblems({ ...filled, city: '', countryCode: 'XX', phone: 'abc' }, ['DE']);
    expect(firstProblemField(problems, ADDRESS_FIELDS)).toBe('city');
    // The form shows the country before the province.
    expect(firstProblemField<AddressForm>({ provinceCode: 'required', countryCode: 'invalidCountry' }, ADDRESS_FIELDS)).toBe('countryCode');
    expect(firstProblemField(addressProblems(filled, ['DE']), ADDRESS_FIELDS)).toBeUndefined();
  });
});
