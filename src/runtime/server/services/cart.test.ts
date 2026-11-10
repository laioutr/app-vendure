import { afterEach, describe, expect, it, vi } from 'vitest';
import { addVariants, adjustLine, applyCoupon, removeLine } from './cart';
import { fakeShopApi } from '../../../../test/fixtures/fakeShopApi';
import { product, variant } from '../../../../test/fixtures/vendure';
import { VendureClient } from '../client/VendureClient';
import { VendureApiError } from '../errors/mapVendureError';

const SHOP = 'https://shop.example.com/shop-api';
const client = (sessionToken?: string) => new VendureClient({ apiUrl: SHOP, sessionToken });

/** A product per id with one variant `v<id>`. */
const productsAnswer = ({ variables }: { variables?: Record<string, unknown> }) => ({
  data: {
    products: { items: (variables!.ids as string[]).map((id) => product({ id, variants: [variant({ id: `v${id}`, productId: id })] })) },
  },
});

const lines = (quantities: Record<string, number>) =>
  Object.entries(quantities).map(([id, quantity]) => ({ quantity, productVariant: { id } }));

const fixedOrder = { __typename: 'OrderModificationError', errorCode: 'ORDER_MODIFICATION_ERROR', message: 'm' };
const transitionRefused = {
  __typename: 'OrderStateTransitionError',
  errorCode: 'ORDER_STATE_TRANSITION_ERROR',
  message: 'm',
  transitionError: 'not allowed',
};

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ productId: `${index + 1}`, variantId: `v${index + 1}`, quantity: 1 }));

describe('addVariants', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds every row in the same three calls, whether one row or thirty', async () => {
    for (const count of [1, 30]) {
      const api = fakeShopApi({
        ProductsByIds: productsAnswer,
        ActiveOrderQuantities: { data: { activeOrder: null } },
        AddItemsToOrder: ({ variables }) => ({
          data: {
            addItemsToOrder: {
              order: {
                lines: (variables!.inputs as { productVariantId: string; quantity: number }[]).map((input) => ({
                  quantity: input.quantity,
                  productVariant: { id: input.productVariantId },
                })),
              },
              errorResults: [],
            },
          },
        }),
      });
      const outcomes = await addVariants(client('token'), client(), rows(count));
      expect(outcomes.every((outcome) => outcome.item.status === 'added')).toBe(true);
      expect(api.operations()).toEqual(['ProductsByIds', 'ActiveOrderQuantities', 'AddItemsToOrder']);
    }
  });

  it('reports each refused row with the error Vendure answered for it, in order', async () => {
    fakeShopApi({
      ProductsByIds: productsAnswer,
      ActiveOrderQuantities: { data: { activeOrder: { lines: lines({ v1: 1 }) } } },
      AddItemsToOrder: {
        data: {
          addItemsToOrder: {
            order: { lines: lines({ v1: 2, v3: 1 }) },
            errorResults: [
              {
                __typename: 'InsufficientStockError',
                errorCode: 'INSUFFICIENT_STOCK_ERROR',
                message: 'Only 1 item was added',
                quantityAvailable: 1,
              },
              { __typename: 'OrderLimitError', errorCode: 'ORDER_LIMIT_ERROR', message: 'ORDER_LIMIT_ERROR' },
            ],
          },
        },
      },
    });
    const outcomes = await addVariants(client('token'), client(), [
      { productId: '1', variantId: 'v1', quantity: 1 },
      { productId: '3', variantId: 'v3', quantity: 5 },
      { productId: '2', variantId: 'v2', quantity: 1 },
      { productId: '9', variantId: 'v-unknown', quantity: 1 },
    ]);
    expect(outcomes.map((outcome) => outcome.item)).toEqual([
      { status: 'added', productId: '1', variantId: 'v1', quantity: 1 },
      { status: 'added', productId: '3', variantId: 'v3', quantity: 1 },
      { status: 'rejected', productId: '2', variantId: 'v2', reason: 'not-orderable' },
      { status: 'rejected', productId: '9', variantId: 'v-unknown', reason: 'not-found' },
    ]);
    expect(outcomes[1]!.message).toEqual({ code: 'quantity-adjusted', level: 'warning' });
    expect(JSON.stringify(outcomes)).not.toContain('Only 1 item');
  });

  it('sends nothing to the cart when no row names a variant the shop sells', async () => {
    const api = fakeShopApi({ ProductsByIds: { data: { products: { items: [] } } } });
    expect((await addVariants(client(), client(), rows(2))).map((outcome) => outcome.item.status)).toEqual(['rejected', 'rejected']);
    expect(api.operations()).toEqual(['ProductsByIds']);
  });

  it('reads no cart before adding for a visitor without a session', async () => {
    const api = fakeShopApi({
      ProductsByIds: productsAnswer,
      AddItemsToOrder: { data: { addItemsToOrder: { order: { lines: lines({ v1: 1 }) }, errorResults: [] } } },
    });
    await addVariants(client(), client(), rows(1));
    expect(api.operations()).toEqual(['ProductsByIds', 'AddItemsToOrder']);
  });

  it('fails the whole add, logged, when the server fails rather than refusing a row', async () => {
    const error = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeShopApi({ ProductsByIds: productsAnswer, AddItemsToOrder: { status: 502 } });
    await expect(addVariants(client(), client(), rows(2))).rejects.toBeInstanceOf(VendureApiError);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('v1, v2'), expect.any(VendureApiError));
    error.mockRestore();
  });
});

describe('applyCoupon', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports a refused code on its row, without Vendure's text", async () => {
    fakeShopApi({
      ApplyCouponCode: {
        data: {
          applyCouponCode: {
            __typename: 'CouponCodeInvalidError',
            errorCode: 'COUPON_CODE_INVALID_ERROR',
            message: 'Coupon code "X" is not valid',
          },
        },
      },
    });
    expect(await applyCoupon(client('t'), 'X')).toEqual({ status: 'rejected', sku: 'X', reason: 'not-found' });
  });

  it('throws when the server fails', async () => {
    fakeShopApi({ ApplyCouponCode: { status: 500 } });
    await expect(applyCoupon(client('t'), 'X')).rejects.toBeInstanceOf(VendureApiError);
  });
});

describe('adjustLine', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers a message when the stock cut the quantity, and throws any other refusal', async () => {
    fakeShopApi({
      AdjustOrderLine: {
        data: {
          adjustOrderLine: {
            __typename: 'InsufficientStockError',
            errorCode: 'INSUFFICIENT_STOCK_ERROR',
            message: 'm',
            quantityAvailable: 2,
          },
        },
      },
    });
    expect(await adjustLine(client('t'), 'l1', 5)).toEqual({ code: 'quantity-adjusted', level: 'warning' });

    vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
    fakeShopApi({
      AdjustOrderLine: { data: { adjustOrderLine: fixedOrder } },
      TransitionOrderToState: { data: { transitionOrderToState: transitionRefused } },
    });
    await expect(adjustLine(client('t'), 'l1', 5)).rejects.toMatchObject({ data: { reason: 'order-not-modifiable' } });
  });
});

describe('a cart edit while the order awaits payment', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** An order fixed for payment until it is moved back; the second answer is after the move. */
  const awaitingPayment = (fixed: unknown, edited: unknown) => {
    let reopened = false;
    return {
      reopened: () => reopened,
      answer: () => (reopened ? edited : fixed),
      reopen: ({ variables }: { variables?: Record<string, unknown> }) => {
        reopened = variables?.state === 'AddingItems';
        return { data: { transitionOrderToState: { __typename: 'Order' } } };
      },
    };
  };

  it('reopens the order once and changes the line', async () => {
    const order = awaitingPayment(fixedOrder, { __typename: 'Order' });
    const api = fakeShopApi({
      AdjustOrderLine: () => ({ data: { adjustOrderLine: order.answer() } }),
      TransitionOrderToState: order.reopen,
    });
    expect(await adjustLine(client('t'), 'l1', 3)).toBeUndefined();
    expect(api.operations()).toEqual(['AdjustOrderLine', 'TransitionOrderToState', 'AdjustOrderLine']);
  });

  it('reopens the order once and removes the line', async () => {
    const order = awaitingPayment(fixedOrder, { __typename: 'Order', id: 'o1' });
    const api = fakeShopApi({
      RemoveOrderLine: () => ({ data: { removeOrderLine: order.answer() } }),
      TransitionOrderToState: order.reopen,
    });
    await removeLine(client('t'), 'l1');
    expect(api.operations()).toEqual(['RemoveOrderLine', 'TransitionOrderToState', 'RemoveOrderLine']);
  });

  it('reopens the order once and adds the rows Vendure refused as fixed', async () => {
    const added = { order: { lines: lines({ v1: 1 }) }, errorResults: [] };
    const refused = { order: { lines: [] }, errorResults: [fixedOrder] };
    const order = awaitingPayment(refused, added);
    const api = fakeShopApi({
      ProductsByIds: productsAnswer,
      ActiveOrderQuantities: { data: { activeOrder: { lines: [] } } },
      AddItemsToOrder: () => ({ data: { addItemsToOrder: order.answer() } }),
      TransitionOrderToState: order.reopen,
    });
    const [outcome] = await addVariants(client('t'), client(), rows(1));
    expect(outcome!.item.status).toBe('added');
    expect(api.operations()).toEqual([
      'ProductsByIds',
      'ActiveOrderQuantities',
      'AddItemsToOrder',
      'TransitionOrderToState',
      'AddItemsToOrder',
    ]);
  });

  it('answers the refusal when the order cannot be moved back, without trying again', async () => {
    vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
    const api = fakeShopApi({
      RemoveOrderLine: { data: { removeOrderLine: fixedOrder } },
      TransitionOrderToState: { data: { transitionOrderToState: transitionRefused } },
    });
    await expect(removeLine(client('t'), 'l1')).rejects.toMatchObject({ data: { reason: 'order-not-modifiable' } });
    expect(api.operations()).toEqual(['RemoveOrderLine', 'TransitionOrderToState']);
  });
});
