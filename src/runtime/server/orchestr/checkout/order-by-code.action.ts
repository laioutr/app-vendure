import { OrderNotFoundError } from '@laioutr-core/canonical-types/ecommerce';
import { VendureCheckoutOrderByCodeAction } from '../../../shared/tokens/checkout';
import { defineVendureAction } from '../../middleware/defineVendure';
import { orderByCode } from '../../services/checkout';
import { placedOrderToShow } from '../../utils/placedOrders';
import { readPlacedOrderCodes } from '../../utils/session';

export default defineVendureAction(VendureCheckoutOrderByCodeAction, ({ context, input, event }) => {
  const shown = placedOrderToShow(input.code, readPlacedOrderCodes(event));
  if (!shown) throw new OrderNotFoundError('');
  return orderByCode(context.vendureClient, shown.code, shown.placedHere);
});
