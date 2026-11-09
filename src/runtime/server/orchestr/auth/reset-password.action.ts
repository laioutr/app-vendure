import { AuthResetPasswordAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { resetPassword } from '../../services/auth';

export default defineVendureAction(AuthResetPasswordAction, async ({ context, input }) => {
  await resetPassword(context.vendureClient, input.link, input.newPassword);
});
