import { describe, expect, it } from 'vitest';
import { placedOrdersSecret, placedOrderToShow, readPlacedOrders, withPlacedOrder } from './placedOrders';

describe('placed orders', () => {
  it('reads back what it signed, and nothing signed with another key', () => {
    const value = withPlacedOrder([], 'C1', 'key');
    expect(readPlacedOrders(value, 'key')).toEqual(['C1']);
    expect(readPlacedOrders(value, 'other-key')).toEqual([]);
    expect(readPlacedOrders(undefined, 'key')).toEqual([]);
    expect(readPlacedOrders('no-signature', 'key')).toEqual([]);
  });

  it('keeps the latest five, each once', () => {
    let codes: string[] = [];
    for (const code of ['A', 'B', 'C', 'D', 'E', 'F', 'B']) codes = readPlacedOrders(withPlacedOrder(codes, code, 'key'), 'key');
    expect(codes).toEqual(['C', 'D', 'E', 'F', 'B']);
  });

  it('signs with the project secret, else with a key of this process', () => {
    expect(placedOrdersSecret('project')).toBe('project');
    expect(placedOrdersSecret('')).toBe(placedOrdersSecret(false));
    expect(placedOrdersSecret(undefined)).not.toBe('');
  });

  it('shows the code asked for, else the newest placed here, and says whether this browser placed it', () => {
    expect(placedOrderToShow(undefined, ['A', 'B'])).toEqual({ code: 'B', placedHere: true });
    expect(placedOrderToShow('A', ['A', 'B'])).toEqual({ code: 'A', placedHere: true });
    expect(placedOrderToShow('X', ['A'])).toEqual({ code: 'X', placedHere: false });
    expect(placedOrderToShow(undefined, [])).toBeUndefined();
  });
});
