import { AuthRegisterAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineVendureAction } from '../../middleware/defineVendure';
import { register } from '../../services/auth';
import { createAddress } from '../../services/customer';

/**
 * Consents are not stored: Vendure keeps no consent of its own. The address can be stored only once
 * the customer is signed in, so a registration waiting for its email confirmation stores none.
 */
export default defineVendureAction(AuthRegisterAction, async ({ context, input }) => {
  const status = await register(context.vendureClient, {
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    title: input.salutation,
    phone: input.address.phone,
  });
  if (status === 'signed-in') await createAddress(context.vendureClient, input.address);
  return { status };
});
