import { describe, expect, it } from 'vitest';
import { firstOpenStep, isStepReachable } from './checkoutSteps';

const address = { firstName: 'A', lastName: 'B', address1: 'x', city: 'y', postalCode: '1', countryCode: 'DE' };
const customer = { email: 'a@b.de', firstName: 'A', lastName: 'B' };

describe('firstOpenStep', () => {
  it('continues where the order left off', () => {
    expect(firstOpenStep({ customer: undefined, shippingAddress: address, shippingMethodIds: ['1'] })).toBe('contact');
    expect(firstOpenStep({ customer, shippingAddress: { ...address, city: '' }, shippingMethodIds: [] })).toBe('address');
    expect(firstOpenStep({ customer, shippingAddress: address, shippingMethodIds: [] })).toBe('delivery');
    expect(firstOpenStep({ customer, shippingAddress: address, shippingMethodIds: ['1'] })).toBe('payment');
  });

  it('opens a step only once every step before it is filled', () => {
    expect(isStepReachable('contact', 'delivery')).toBe(true);
    expect(isStepReachable('delivery', 'delivery')).toBe(true);
    expect(isStepReachable('payment', 'delivery')).toBe(false);
  });
});
