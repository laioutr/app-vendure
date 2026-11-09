import { describe, expect, it } from 'vitest';
import { isEmailChangeLink, tokenFromLink } from './authLinks';
import { batchRejectionReasonOf, stockShortfallOf } from './cartResult';
import { salutationKeyOf } from './customer';
import { offsetOfCursor } from './pageIndex';
import { monthlyStatistics } from './statistics';
import { ProductNotFoundError, ProductStockError } from '@laioutr-core/canonical-types/ecommerce';

describe('auth links', () => {
  it('reads the token and tells an email change from a new account', () => {
    expect(tokenFromLink('https://shop.example.com/verify?token=abc')).toBe('abc');
    expect(tokenFromLink('https://shop.example.com/verify')).toBeUndefined();
    expect(tokenFromLink('not a url')).toBeUndefined();
    expect(isEmailChangeLink('https://shop.example.com/verify-email-address-change?token=a')).toBe(true);
    expect(isEmailChangeLink('https://shop.example.com/verify?token=a')).toBe(false);
  });
});

describe('statistics', () => {
  it('sums orders per month and leaves out unplaced ones', () => {
    expect(
      monthlyStatistics([
        { orderPlacedAt: '2026-01-05T00:00:00Z', totalWithTax: 100, currencyCode: 'EUR' },
        { orderPlacedAt: '2026-01-20T00:00:00Z', totalWithTax: 50, currencyCode: 'EUR' },
        { orderPlacedAt: '2026-03-01T00:00:00Z', totalWithTax: 10, currencyCode: 'EUR' },
        { orderPlacedAt: null, totalWithTax: 999, currencyCode: 'EUR' },
      ])
    ).toEqual([
      { month: 1, orderCount: 2, orderTotal: { amount: 150, currency: 'EUR' } },
      { month: 3, orderCount: 1, orderTotal: { amount: 10, currency: 'EUR' } },
    ]);
  });

  it('reports no total for a month in two currencies', () => {
    expect(monthlyStatistics([
      { orderPlacedAt: '2026-01-05T00:00:00Z', totalWithTax: 100, currencyCode: 'EUR' },
      { orderPlacedAt: '2026-01-06T00:00:00Z', totalWithTax: 100, currencyCode: 'USD' },
    ])[0]).toEqual({ month: 1, orderCount: 2, orderTotal: undefined });
  });
});

describe('small mappers', () => {
  it('reads a page index cursor as an offset', () => {
    expect(offsetOfCursor('200')).toBe(200);
    expect(offsetOfCursor(undefined)).toBe(0);
    expect(offsetOfCursor('x')).toBe(0);
  });

  it('turns a Vendure title into a salutation key', () => {
    expect(salutationKeyOf('Mr.')).toBe('mr');
    expect(salutationKeyOf('')).toBeUndefined();
  });

  it('reads what the stock allowed after a shortfall', () => {
    expect(stockShortfallOf({ errorCode: 'INSUFFICIENT_STOCK_ERROR', quantityAvailable: 3 })).toBe(3);
    expect(stockShortfallOf({ errorCode: 'INSUFFICIENT_STOCK_ERROR', quantityAvailable: 0 })).toBeUndefined();
    expect(stockShortfallOf({ __typename: 'Order' })).toBeUndefined();
  });

  it('names why a batch row was rejected', () => {
    expect(batchRejectionReasonOf(new ProductNotFoundError('v'))).toBe('not-found');
    expect(batchRejectionReasonOf(new ProductStockError('v', 'OUT_OF_STOCK'))).toBe('sold-out');
    expect(batchRejectionReasonOf(new Error('x'))).toBe('not-orderable');
  });
});
