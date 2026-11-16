/**
 * Validation utilities and constants for Reality.OS authentication.
 */

export const MAX_FULL_NAME_LENGTH = 50;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 50;
export const MAX_ORGANIZATION_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;

/**
 * Validates whether an email string is structurally sound and includes a valid domain with TLD.
 * Specifically rejects malformed patterns like "harsh099@2026" (no dot/TLD in host part).
 */
export function isValidEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return false;

  // RFC 5322-compliant structure requiring at least one dot in domain and a >= 2 character TLD
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) return false;

  // Ensure the top-level domain has at least 2 characters (rejects trailing dot or 1-char TLDs)
  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const domainParts = parts[1].split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) return false;

  return true;
}

/**
 * Validates a user's full name:
 * - Must be non-empty and non-whitespace.
 * - Maximum 50 characters.
 */
export function validateFullName(name: string | undefined | null): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Full Name is required and cannot be empty." };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Full Name is required and cannot be empty." };
  }
  if (trimmed.length > MAX_FULL_NAME_LENGTH) {
    return {
      valid: false,
      error: `Full Name must not exceed ${MAX_FULL_NAME_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

/**
 * Validates a user's password:
 * - Minimum 6 characters.
 * - Maximum 50 characters.
 * - Preserves password casing, spaces, and special characters. Never truncates.
 */
export function validatePassword(password: string | undefined | null): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }
  return { valid: true };
}
