export const MIN_ADMIN_PASSWORD_LENGTH = 12;
export const MAX_ADMIN_PASSWORD_LENGTH = 128;

export const ADMIN_SETUP_SECRET_NAMES = [
  "MICROFEED_SETUP_ADMIN_EMAIL",
  "MICROFEED_SETUP_ADMIN_PASSWORD",
  "MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION",
] as const;

export interface AdminSetupCredentials {
  email: string;
  password: string;
  passwordConfirmation: string;
}

export function normalizeAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateAdminEmail(value: string): string | undefined {
  const email = normalizeAdminEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
    ? undefined
    : "Enter a valid email address.";
}

export function validateAdminPassword(value: string): string | undefined {
  const length = Array.from(value).length;
  if (length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  if (length > MAX_ADMIN_PASSWORD_LENGTH) {
    return `Use no more than ${MAX_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

export function validateAdminSetupCredentials(
  credentials: AdminSetupCredentials,
): string | undefined {
  return validateAdminEmail(credentials.email) ??
    validateAdminPassword(credentials.password) ??
    (
      credentials.password === credentials.passwordConfirmation
        ? undefined
        : "The passwords do not match."
    );
}
