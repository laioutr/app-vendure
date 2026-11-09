import { VendureCheckoutSetBillingAddressAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { setBillingAddress } from '../../services/checkout';

export default defineVendureAction(VendureCheckoutSetBillingAddressAction, ({ context, input }) =>
  setBillingAddress(context.vendureClient, input.address)
);
