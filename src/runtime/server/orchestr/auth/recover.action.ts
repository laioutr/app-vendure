import { AuthRecoverAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { requestPasswordReset } from '../../services/auth';

export default defineVendureAction(AuthRecoverAction, async ({ context, input }) => {
  await requestPasswordReset(context.vendureClient, input.email);
});
