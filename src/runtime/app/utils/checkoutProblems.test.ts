import { describe, expect, it } from 'vitest';
import { checkoutProblemOf, needsReload } from './checkoutProblems';

/** A refusal as the browser receives it: the fetch error, the server's answer, the serialized typed error. */
const refusal = (statusCode: number, error: Record<string, unknown>) =>
  Object.assign(new Error('Action failed'), { statusCode, data: { statusCode, statusMessage: 'Action failed', data: error } });

describe('checkoutProblemOf', () => {
  it("tells a declined payment by the order error's reason", () => {
    const declined = refusal(400, { name: 'VendureOrderError', message: 'internal', data: { reason: 'payment-declined' } });
    expect(checkoutProblemOf(declined)).toBe('paymentDeclined');
    expect(checkoutProblemOf(refusal(400, { name: 'VendureOrderError', data: { reason: 'order-not-ready' } }))).toBe('orderNotReady');
  });

  it('tells an email of an account by its class or its conflict status', () => {
    expect(checkoutProblemOf(refusal(409, { name: 'EmailAlreadyInUseError' }))).toBe('emailInUse');
    expect(checkoutProblemOf(refusal(409, { name: 'x' }))).toBe('emailInUse');
  });

  it("never passes the server's own words on, and reads every other failure as try again", () => {
    expect(checkoutProblemOf(refusal(400, { name: 'InvalidFieldError', data: { reason: 'INVALID_VALUE', field: ['x'] } }))).toBe(
      'checkDetails'
    );
    expect(checkoutProblemOf(new TypeError('Failed to fetch'))).toBe('unknown');
    expect(checkoutProblemOf(refusal(500, { name: 'Error', message: 'secret stack' }))).toBe('unknown');
    expect(checkoutProblemOf(undefined)).toBe('unknown');
  });

  it('reads the order again when it changed underneath', () => {
    expect(needsReload('orderChanged')).toBe(true);
    expect(needsReload('couponRemoved')).toBe(true);
    expect(needsReload('paymentDeclined')).toBe(false);
  });
});
