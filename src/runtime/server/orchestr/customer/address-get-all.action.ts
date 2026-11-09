import { AddressGetAllAction } from '@laioutr-core/canonical-types/ecommerce';
import { addressBookOf } from '../../mappers/customer';
import { defineVendureAction } from '../../middleware/defineVendure';
import { activeCustomerOf } from '../../services/customer';

export default defineVendureAction(AddressGetAllAction, async ({ context }) => ({
  addresses: addressBookOf(await activeCustomerOf(context.vendureClient)),
}));
