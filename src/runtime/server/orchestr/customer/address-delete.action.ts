import { CustomerAddressDeleteAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { deleteAddress } from '../../services/customer';

export default defineVendureAction(CustomerAddressDeleteAction, async ({ context, input }) => {
  await deleteAddress(context.vendureClient, input.id);
});
