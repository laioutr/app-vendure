import { VendureCheckoutOrderByCodeAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { orderByCode } from '../../services/checkout';
import { readPlacedOrderCodes } from '../../utils/session';

export default defineVendureAction(VendureCheckoutOrderByCodeAction, ({ context, input, event }) =>
  orderByCode(context.vendureClient, input.code, readPlacedOrderCodes(event).includes(input.code))
);
