/**
 * Vendure's emails link to the storefront with the token in the `token` query parameter (the
 * EmailPlugin's default templates: `/verify?token=…`, `/password-reset?token=…`,
 * `/verify-email-address-change?token=…`).
 */
export const tokenFromLink = (link: string): string | undefined => {
  try {
    return new URL(link).searchParams.get('token') || undefined;
  } catch {
    return undefined;
  }
};

/** Whether a confirmation link confirms an email change rather than a new account. */
export const isEmailChangeLink = (link: string): boolean => {
  try {
    return /email[-_]?address[-_]?change|change[-_]?email/i.test(new URL(link).pathname);
  } catch {
    return false;
  }
};
