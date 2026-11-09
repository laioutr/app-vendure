import { CustomerAddressSetDefaultAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { setDefaultAddress } from '../../services/customer';

export default defineVendureAction(CustomerAddressSetDefaultAction, async ({ context, input }) => {
  await setDefaultAddress(context.vendureClient, input.id, input.type);
});
