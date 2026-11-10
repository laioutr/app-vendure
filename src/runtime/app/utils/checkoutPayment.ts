import type { VendurePaymentMethodQuote } from '../../shared/tokens/checkout';
import type { CheckoutMessages } from '../i18n/messages';
import type { z } from 'zod/v4';

type PaymentMethod = z.infer<typeof VendurePaymentMethodQuote>;

export interface PaymentChoice {
  code: string;
  name: string;
  description?: string;
  selectable: boolean;
  /** False when it is paid in a provider's own flow, which this page does not run. */
  completesHere: boolean;
  /** Why it cannot be chosen; absent when it can. */
  note?: string;
}

const noteOf = (method: PaymentMethod, messages: Pick<CheckoutMessages, 'paymentNotHere' | 'paymentNotEligible'>) => {
  if (!method.completesHere) return messages.paymentNotHere;
  if (!method.isEligible) return method.eligibilityMessage || messages.paymentNotEligible;
  return undefined;
};

/**
 * Every payment method the shop answers, each said honestly: one Vendure does not offer for this
 * order says why (the shop's own words where it has them), and one paid in a provider's own flow says it cannot be paid on this page.
 */
export const paymentChoicesOf = (
  methods: readonly PaymentMethod[],
  messages: Pick<CheckoutMessages, 'paymentNotHere' | 'paymentNotEligible'>
): PaymentChoice[] =>
  methods.map((method) => {
    const note = noteOf(method, messages);
    return {
      code: method.code,
      name: method.name,
      description: method.description,
      selectable: method.isEligible && method.completesHere,
      completesHere: method.completesHere,
      ...(note ? { note } : {}),
    };
  });

/** The choice kept when it can still be chosen, else the first that can; none when none can. */
export const paymentChoiceAfter = (choices: readonly PaymentChoice[], current: string | undefined): string | undefined =>
  choices.find((choice) => choice.code === current && choice.selectable)?.code ?? choices.find((choice) => choice.selectable)?.code;

/**
 * What to tell the shopper when no method can be chosen: that the shop's methods cannot be paid on this
 * page yet (some run in a provider's own flow), or that none applies to this order. Nothing while one can
 * be chosen.
 */
export const paymentNoticeOf = (choices: readonly PaymentChoice[]): 'noPaymentMethods' | 'noPayableMethods' | undefined => {
  if (choices.some((choice) => choice.selectable)) return undefined;
  return choices.some((choice) => !choice.completesHere) ? 'noPayableMethods' : 'noPaymentMethods';
};
