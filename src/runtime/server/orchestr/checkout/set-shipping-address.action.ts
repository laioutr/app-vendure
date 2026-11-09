import { VendureCheckoutSetShippingAddressAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { setShippingAddress } from '../../services/checkout';

export default defineVendureAction(VendureCheckoutSetShippingAddressAction, ({ context, input }) => setShippingAddress(context.vendureClient, input.address));
