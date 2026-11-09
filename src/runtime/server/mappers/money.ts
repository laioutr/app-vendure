import type { Money } from '@laioutr-core/core-types/common';

/** Vendure already answers integer minor units, so a Money is the amount and its ISO code. */
export const money = (amount: number, currency: string): Money => ({ amount: Math.round(amount), currency: currency.toUpperCase() });

/** Whole percent saved off `strikethrough`; undefined when nothing is saved. */
export const savingsPercentOf = (price: Money, strikethrough: Money | undefined): number | undefined =>
  strikethrough && strikethrough.amount > price.amount ? Math.round((1 - price.amount / strikethrough.amount) * 100) : undefined;
