import { VendureCheckoutSetShippingMethodAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { setShippingMethod } from '../../services/checkout';

export default defineVendureAction(VendureCheckoutSetShippingMethodAction, ({ context, input }) =>
  setShippingMethod(context.vendureClient, input.shippingMethodIds)
);
