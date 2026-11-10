import { describe, expect, it } from 'vitest';
import { paymentChoiceAfter, paymentChoicesOf, paymentNoticeOf } from './checkoutPayment';

const messages = { paymentNotHere: 'not here', paymentNotEligible: 'not for this order' };
const method = (code: string, overrides: Partial<{ isEligible: boolean; completesHere: boolean; eligibilityMessage: string }> = {}) => ({
  code,
  name: code,
  isEligible: true,
  completesHere: true,
  ...overrides,
});

describe('paymentChoicesOf', () => {
  it('offers what completes here and says why the rest cannot be chosen', () => {
    const choices = paymentChoicesOf(
      [
        method('standard'),
        method('stripe', { completesHere: false }),
        method('invoice', { isEligible: false, eligibilityMessage: 'Only above $100' }),
        method('cod', { isEligible: false }),
      ],
      messages
    );
    expect(choices.map(({ code, selectable, note }) => ({ code, selectable, note }))).toEqual([
      { code: 'standard', selectable: true, note: undefined },
      { code: 'stripe', selectable: false, note: 'not here' },
      { code: 'invoice', selectable: false, note: 'Only above $100' },
      { code: 'cod', selectable: false, note: 'not for this order' },
    ]);
  });

  it('keeps a choice that can still be made, else takes the first that can', () => {
    const choices = paymentChoicesOf([method('a', { completesHere: false }), method('b'), method('c')], messages);
    expect(paymentChoiceAfter(choices, 'c')).toBe('c');
    expect(paymentChoiceAfter(choices, 'a')).toBe('b');
    expect(paymentChoiceAfter(choices, undefined)).toBe('b');
    expect(paymentChoiceAfter([], 'b')).toBeUndefined();
  });

  it('says when no method can be paid on this page, and when none applies to the order', () => {
    expect(paymentNoticeOf(paymentChoicesOf([method('standard'), method('stripe', { completesHere: false })], messages))).toBeUndefined();
    expect(
      paymentNoticeOf(paymentChoicesOf([method('stripe', { completesHere: false }), method('cod', { isEligible: false })], messages))
    ).toBe('noPayableMethods');
    expect(paymentNoticeOf(paymentChoicesOf([method('cod', { isEligible: false })], messages))).toBe('noPaymentMethods');
    expect(paymentNoticeOf([])).toBe('noPaymentMethods');
  });
});
