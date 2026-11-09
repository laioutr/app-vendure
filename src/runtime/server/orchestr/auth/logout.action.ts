import { AuthLogoutAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { logout } from '../../services/auth';
import { clearSessionToken } from '../../utils/session';

/** The storefront forgets the session even when Vendure cannot end it: the visitor asked to leave. */
export default defineVendureAction(AuthLogoutAction, async ({ context, event }) => {
  try {
    await logout(context.vendureClient);
  } finally {
    clearSessionToken(event);
  }
});
