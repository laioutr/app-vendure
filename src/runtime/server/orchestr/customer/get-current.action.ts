import { CustomerGetCurrentAction } from '@laioutr-core/canonical-types/ecommerce';
import { toCanonicalCustomer } from '../../mappers/customer';
import { defineVendureAction } from '../../middleware/defineVendure';
import { activeCustomerOf } from '../../services/customer';

export default defineVendureAction(CustomerGetCurrentAction, async ({ context }) => ({
  customer: toCanonicalCustomer(await activeCustomerOf(context.vendureClient)),
}));
