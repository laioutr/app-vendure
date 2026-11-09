import { CustomerChangeEmailAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { changeEmail } from '../../services/customer';

export default defineVendureAction(CustomerChangeEmailAction, async ({ context, input }) => ({
  status: await changeEmail(context.vendureClient, input.email, input.currentPassword),
}));
