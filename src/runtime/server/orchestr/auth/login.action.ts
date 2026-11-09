import { AuthLoginAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { login } from '../../services/auth';

// Vendure moves the visitor's cart into the customer's on login, and rotates the session token,
// which the client persists.
export default defineVendureAction(AuthLoginAction, async ({ context, input }) => {
  await login(context.vendureClient, input.email, input.password);
  return { success: true };
});
