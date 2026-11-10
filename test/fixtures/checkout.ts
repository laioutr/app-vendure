import type { CheckoutOrder } from '../../src/runtime/app/utils/checkoutForms';

const usd = (amount: number) => ({ amount, currency: 'USD' });

/** An active order as `get-state` answers it, for the checkout's tests. */
export const checkoutOrder = (overrides: Partial<CheckoutOrder> = {}): CheckoutOrder => ({
  id: '7',
  code: 'ABC',
  state: 'AddingItems',
  customer: undefined,
  shippingAddress: undefined,
  billingAddress: undefined,
  shippingMethodIds: [],
  couponCodes: [],
  totalQuantity: 2,
  subtotal: usd(4558),
  shipping: usd(500),
  discounts: [],
  tax: usd(800),
  total: usd(5058),
  lines: [
    {
      id: 'l1',
      productId: 'p1',
      variantId: 'v1',
      title: 'Mouse',
      subtitle: 'Black',
      sku: 'MOUSE',
      quantity: 2,
      unitPrice: usd(2279),
      subtotal: usd(4558),
      total: usd(4558),
      imageUrl: 'https://cdn.example.com/m.jpg',
    },
  ],
  ...overrides,
});
