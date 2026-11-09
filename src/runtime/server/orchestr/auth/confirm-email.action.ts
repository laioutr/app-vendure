import { AuthConfirmEmailAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { confirmEmail } from '../../services/auth';

export default defineVendureAction(AuthConfirmEmailAction, async ({ context, input }) => ({
  status: await confirmEmail(context.vendureClient, input.link),
}));
