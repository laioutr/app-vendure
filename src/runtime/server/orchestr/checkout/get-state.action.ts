import { VendureCheckoutGetStateAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { getCheckoutState } from '../../services/checkout';

export default defineVendureAction(VendureCheckoutGetStateAction, ({ context }) =>
  getCheckoutState(context.vendureClient, context.currencyCode, context.providerPaymentMethods)
);
