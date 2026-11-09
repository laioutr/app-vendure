import {
  EmailAlreadyInUseError,
  EmailConfirmationTokenInvalidError,
  InvalidCredentialsError,
  PasswordResetTokenInvalidError,
} from '@laioutr-core/canonical-types/ecommerce';
import type { VendureClient } from '../client/VendureClient';
import { operations } from '../client/operations';
import { isEmailChangeLink, tokenFromLink } from '../mappers/authLinks';

export const login = async (client: VendureClient, email: string, password: string) => {
  await client.mutate(operations.login, { username: email, password }, 'login');
};

export const logout = async (client: VendureClient) => {
  try {
    if (client.hasSession) await client.request(operations.logout);
  } finally {
    client.dropSession();
  }
};

interface Registration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  title?: string;
  phone?: string;
}

/**
 * Registers and signs the customer in with the same credentials. Vendure answers a registration the
 * same way whether or not the address has an account, so the sign-in tells the outcome: signed in,
 * waiting for the email to be confirmed, or refused because an account with another password exists.
 */
export const register = async (client: VendureClient, registration: Registration): Promise<'signed-in' | 'pending-confirmation'> => {
  await client.mutate(
    operations.registerCustomerAccount,
    {
      input: {
        emailAddress: registration.email,
        password: registration.password,
        firstName: registration.firstName,
        lastName: registration.lastName,
        title: registration.title,
        phoneNumber: registration.phone,
      },
    },
    'registerCustomerAccount'
  );

  const { login: result } = await client.request(operations.login, { username: registration.email, password: registration.password });
  if (result.__typename === 'CurrentUser') return 'signed-in';
  if (result.__typename === 'NotVerifiedError') return 'pending-confirmation';
  if (result.__typename === 'InvalidCredentialsError') throw new EmailAlreadyInUseError();
  throw new InvalidCredentialsError();
};

/** A new account's confirmation signs the customer in; an email change's leaves the session as it is. */
export const confirmEmail = async (client: VendureClient, link: string): Promise<'signed-in' | 'confirmed'> => {
  const token = tokenFromLink(link);
  if (!token) throw new EmailConfirmationTokenInvalidError();
  if (isEmailChangeLink(link)) {
    await client.mutate(operations.updateCustomerEmailAddress, { token }, 'updateCustomerEmailAddress');
    return 'confirmed';
  }
  await client.mutate(operations.verifyCustomerAccount, { token }, 'verifyCustomerAccount');
  return 'signed-in';
};

export const requestPasswordReset = async (client: VendureClient, email: string) => {
  await client.mutate(operations.requestPasswordReset, { emailAddress: email }, 'requestPasswordReset');
};

/**
 * Vendure signs the customer in with the new password; the session is dropped, since the customer
 * continues to the login, and the visitor's own session (their cart) stays as it was.
 */
export const resetPassword = async (client: VendureClient, link: string, newPassword: string) => {
  const token = tokenFromLink(link);
  if (!token) throw new PasswordResetTokenInvalidError('invalid');
  await client
    .withoutSession()
    .mutate(operations.resetPassword, { token, password: newPassword }, 'resetPassword', { passwordField: 'newPassword' });
};
