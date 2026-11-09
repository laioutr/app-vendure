import { VendureCheckoutSetCustomerAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { setCustomer } from '../../services/checkout';

export default defineVendureAction(VendureCheckoutSetCustomerAction, ({ context, input }) => setCustomer(context.vendureClient, input));
