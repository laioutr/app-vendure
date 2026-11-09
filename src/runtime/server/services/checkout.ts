import { OrderNotFoundError } from '@laioutr-core/canonical-types/ecommerce';
import type { VendureClient } from '../client/VendureClient';
import type { MailingAddressValue } from '../mappers/address';
import { VendureOrderError } from '../../shared/errors';
import { operations } from '../client/operations';
import { toCreateAddressInput } from '../mappers/address';
import { checkoutOrder, checkoutState } from '../mappers/checkout';

export const getCheckoutState = async (client: VendureClient, fallbackCurrency: string) => {
  // Without a session there is no order, and asking would only start a session.
  if (!client.hasSession) return { order: null, shippingMethods: [], paymentMethods: [], nextStates: [], countries: [] };
  return checkoutState(await client.request(operations.checkoutState), fallbackCurrency);
};

export const setCustomer = async (
  client: VendureClient,
  customer: { email: string; firstName: string; lastName: string; phone?: string }
) => {
  await client.mutate(
    operations.setCustomerForOrder,
    { input: { emailAddress: customer.email, firstName: customer.firstName, lastName: customer.lastName, phoneNumber: customer.phone } },
    'setCustomerForOrder'
  );
};

export const setShippingAddress = async (client: VendureClient, address: MailingAddressValue) => {
  await client.mutate(operations.setOrderShippingAddress, { input: toCreateAddressInput(address) }, 'setOrderShippingAddress');
};

export const setBillingAddress = async (client: VendureClient, address: MailingAddressValue) => {
  await client.mutate(operations.setOrderBillingAddress, { input: toCreateAddressInput(address) }, 'setOrderBillingAddress');
};

export const setShippingMethod = async (client: VendureClient, ids: string[]) => {
  await client.mutate(operations.setOrderShippingMethod, { ids }, 'setOrderShippingMethod');
};

export const transitionOrder = async (client: VendureClient, state: string) => {
  const { transitionOrderToState: result } = await client.request(operations.transitionOrderToState, { state });
  // Vendure answers null when there is no active order to move.
  if (!result) throw new VendureOrderError('no-active-order');
  if (result.__typename === 'OrderStateTransitionError') {
    console.warn(`[vendure] Order cannot move to ${state}: ${result.transitionError}`);
    throw new VendureOrderError('order-not-ready');
  }
  return { state };
};

export const addPayment = async (client: VendureClient, method: string, metadata: Record<string, unknown> | undefined) => {
  const order = await client.mutate(operations.addPaymentToOrder, { input: { method, metadata: metadata ?? {} } }, 'addPaymentToOrder');
  if (order.__typename !== 'Order') throw new VendureOrderError('payment-failed');
  return { code: order.code, state: order.state };
};

/**
 * A placed order by its code, for the confirmation page: answered to the browser that placed it
 * (`placedHere`) and to the signed-in customer it belongs to, and to nobody else. Vendure itself
 * answers a guest's order to anyone holding the code for a while, so its answer alone decides nothing.
 */
export const orderByCode = async (client: VendureClient, code: string, placedHere: boolean) => {
  if (!placedHere && !client.hasSession) throw new OrderNotFoundError(code);
  const { orderByCode: order, activeCustomer } = await client.request(operations.orderByCode, { code }, { orderCode: code });
  const ownOrder = !!activeCustomer && order?.customer?.id === activeCustomer.id;
  if (!order || !(placedHere || ownOrder)) throw new OrderNotFoundError(code);
  return { order: checkoutOrder(order) };
};
