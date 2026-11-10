import { describe, expect, it } from 'vitest';
import { isCartChange } from './cartChanges';
import {
  CartAddItemsAction,
  CartRemoveItemsAction,
  CartUpdateItemsAction,
  CustomerGetCurrentAction,
} from '@laioutr-core/canonical-types/ecommerce';
import { VendureCheckoutGetStateAction } from '../../shared/tokens/checkout';

describe('isCartChange', () => {
  it('answers the cart actions, and not the checkout reading the cart or other actions', () => {
    for (const token of [CartAddItemsAction, CartUpdateItemsAction, CartRemoveItemsAction]) expect(isCartChange(token)).toBe(true);
    expect(isCartChange(VendureCheckoutGetStateAction)).toBe(false);
    expect(isCartChange(CustomerGetCurrentAction)).toBe(false);
  });
});
