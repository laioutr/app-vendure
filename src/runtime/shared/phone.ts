const E164 = /^\+?[1-9]\d{1,14}$/;

/**
 * A phone number in the E.164 form the canonical schema takes, or nothing. People and Vendure both
 * write numbers with spaces, dashes and brackets, which the schema refuses.
 */
export const toE164 = (phone: string | null | undefined): string | undefined => {
  const compact = phone?.replace(/[\s\-().]/g, '');
  return compact && E164.test(compact) ? compact : undefined;
};
