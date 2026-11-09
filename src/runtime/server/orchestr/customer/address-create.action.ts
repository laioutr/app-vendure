import { CustomerAddressCreateAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { createAddress } from '../../services/customer';

export default defineVendureAction(CustomerAddressCreateAction, async ({ context, input }) => {
  await createAddress(context.vendureClient, input.address);
});
