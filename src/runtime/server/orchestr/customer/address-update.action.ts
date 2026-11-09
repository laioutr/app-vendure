import { CustomerAddressUpdateAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { updateAddress } from '../../services/customer';

export default defineVendureAction(CustomerAddressUpdateAction, async ({ context, input }) => {
  await updateAddress(context.vendureClient, input.id, input.address);
});
