import { VendureCheckoutAddPaymentAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { addPayment } from '../../services/checkout';
import { rememberPlacedOrder } from '../../utils/session';

export default defineVendureAction(VendureCheckoutAddPaymentAction, async ({ context, input, event }) => {
  const payment = await addPayment(context.vendureClient, input.method, input.metadata, context.providerPaymentMethods);
  rememberPlacedOrder(event, payment.code);
  return payment;
});
