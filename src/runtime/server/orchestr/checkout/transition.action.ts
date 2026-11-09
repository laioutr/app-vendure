import { VendureCheckoutTransitionAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { transitionOrder } from '../../services/checkout';

export default defineVendureAction(VendureCheckoutTransitionAction, ({ context, input }) =>
  transitionOrder(context.vendureClient, input.state)
);
