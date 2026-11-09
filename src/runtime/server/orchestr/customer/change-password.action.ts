import { CustomerChangePasswordAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { changePassword } from '../../services/customer';

export default defineVendureAction(CustomerChangePasswordAction, async ({ context, input }) => {
  await changePassword(context.vendureClient, input.currentPassword, input.newPassword);
});
