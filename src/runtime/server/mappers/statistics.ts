import type { Money } from '@laioutr-core/core-types/common';

/** Orders summed per month of their placing, in UTC; months without orders are left out. */
export const monthlyStatistics = (orders: readonly { orderPlacedAt: string | null; totalWithTax: number; currencyCode: string }[]) => {
  const months = new Map<number, { month: number; orderCount: number; orderTotal?: Money }>();
  for (const order of orders) {
    if (!order.orderPlacedAt) continue;
    const month = new Date(order.orderPlacedAt).getUTCMonth() + 1;
    const entry = months.get(month) ?? { month, orderCount: 0, orderTotal: { amount: 0, currency: order.currencyCode } };
    entry.orderCount += 1;
    // Orders in another currency cannot be summed into one amount, so the month reports no total.
    entry.orderTotal = entry.orderTotal && entry.orderTotal.currency === order.currencyCode ? { ...entry.orderTotal, amount: entry.orderTotal.amount + order.totalWithTax } : undefined;
    months.set(month, entry);
  }
  return [...months.values()].sort((a, b) => a.month - b.month);
};
