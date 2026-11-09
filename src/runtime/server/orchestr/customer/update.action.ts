import { CustomerUpdateAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { updateCustomer } from '../../services/customer';

export default defineVendureAction(CustomerUpdateAction, async ({ context, input }) => {
  await updateCustomer(context.vendureClient, {
    firstName: input.person?.firstName,
    lastName: input.person?.lastName,
    salutation: input.person?.salutation,
    phone: input.phone,
    customFields: input.customFields,
  });
});
