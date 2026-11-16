import type { AuthProfile } from "@/lib/authStore";
import { DEMO_USER, DEFAULT_DEMO_CREDENTIALS } from "@/lib/authStore";

export const DEMO_COOKIE_NAME = "realityos_demo_session";
export const DEMO_SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
export const MIN_DEMO_SECRET_LENGTH = 32; // Minimum 32 bytes (256 bits of entropy)

export interface DemoSessionPayload {
  sub: string;
  email: string;
  fullName: string;
  organization: string;
  role: "editor";
  isDemo: true;
  iat: number;
  exp: number;
}

export interface DemoSecretValidationResult {
  valid: boolean;
  reason?: "missing" | "too_short";
}

/**
 * Checks whether demo mode is enabled in the current environment.
 * Demo mode is enabled by default unless explicitly disabled via ENABLE_DEMO_MODE="false".
 */
export function isDemoModeEnabled(): boolean {
  return process.env.ENABLE_DEMO_MODE !== "false";
}

/**
 * Validates whether candidate secret string satisfies cryptographic strength requirements.
 * Must be non-empty and at least 32 bytes in length.
 */
export function validateDemoSessionSecret(secret: string | undefined | null): DemoSecretValidationResult {
  if (!secret || typeof secret !== "string" || secret.trim().length === 0) {
    return { valid: false, reason: "missing" };
  }

  const trimmed = secret.trim();
  const byteLength = new TextEncoder().encode(trimmed).byteLength;
  if (byteLength < MIN_DEMO_SECRET_LENGTH) {
    return { valid: false, reason: "too_short" };
  }

  return { valid: true };
}

/**
 * Derives the server-only cryptographic secret for signing and verifying demo session tokens.
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. NEVER uses NEXT_PUBLIC_SUPABASE_ANON_KEY or any other public/client-accessible variable.
 * 2. In production (NODE_ENV === "production"), DEMO_SESSION_SECRET is strictly mandatory
 *    and MUST be at least 32 bytes (256 bits).
 * 3. If DEMO_SESSION_SECRET is missing or < 32 bytes in production, this function returns null
 *    and the entire demo authentication system FAILS CLOSED.
 * 4. Only in non-production environments (development / test) when DEMO_SESSION_SECRET is unset,
 *    a dedicated development testing secret of 64 bytes is used.
 */
export function getDemoSessionSecret(): string | null {
  const isProduction = process.env.NODE_ENV === "production";
  const configured = process.env.DEMO_SESSION_SECRET;

  const validation = validateDemoSessionSecret(configured);
  if (validation.valid && configured) {
    return configured.trim();
  }

  // In production, strictly fail closed. Zero fallbacks to public or hardcoded secrets.
  if (isProduction) {
    return null;
  }

  // Non-production development fallback strictly when NODE_ENV !== "production"
  return "realityos-development-hmac-sha256-secret-strictly-for-local-testing-only-64bytes";
}

/**
 * Returns whether demo session signing is properly configured and cryptographically valid.
 */
export function isDemoSecretConfigured(): boolean {
  return getDemoSessionSecret() !== null;
}

/**
 * Universal base64url encoding using standard Web APIs compatible with Edge Runtime.
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToBase64Url(str: string): string {
  const enc = new TextEncoder();
  return toBase64Url(enc.encode(str));
}

function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToString(base64url: string): string {
  const bytes = base64UrlToBytes(base64url);
  const dec = new TextDecoder();
  return dec.decode(bytes);
}

/**
 * Computes HMAC-SHA256 signature using standard Web Crypto API (crypto.subtle).
 * Supported natively in both Edge Runtime (Vercel) and Node.js.
 */
async function computeHmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/**
 * Cryptographically verifies HMAC-SHA256 signature in constant time.
 * Uses native crypto.subtle.verify which executes constant-time comparison
 * inside the platform cryptographic subsystem, supported in both Edge Runtime (Vercel)
 * and Node.js.
 */
async function verifyHmac(secret: string, data: string, signatureBase64Url: string): Promise<boolean> {
  try {
    const signatureBytes = base64UrlToBytes(signatureBase64Url);
    // SHA-256 HMAC produces exactly 32 bytes (256 bits).
    if (signatureBytes.byteLength !== 32) {
      return false;
    }

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      enc.encode(data) as unknown as BufferSource,
    );
  } catch {
    return false;
  }
}

/**
 * Generates an HMAC-SHA256 signed tamper-proof session token for a verified demo user.
 * The payload strictly enforces the 'editor' role, preventing any privilege escalation.
 * Fails closed and returns null if DEMO_SESSION_SECRET is missing or invalid in production.
 */
export async function createDemoSessionToken(customUser?: Partial<AuthProfile>): Promise<string | null> {
  if (!isDemoModeEnabled()) {
    return null;
  }

  const secret = getDemoSessionSecret();
  if (!secret) {
    // Secret missing or invalid in production: fail closed, NEVER create an unsigned or weakly signed session
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: DemoSessionPayload = {
    sub: customUser?.id || DEMO_USER.id,
    email: customUser?.email || DEMO_USER.email,
    fullName: customUser?.fullName || DEMO_USER.fullName,
    organization: customUser?.organization || DEMO_USER.organization,
    role: "editor", // strictly immutable editor role
    isDemo: true,
    iat: now,
    exp: now + DEMO_SESSION_MAX_AGE,
  };

  const payloadStr = stringToBase64Url(JSON.stringify(payload));
  const signature = await computeHmac(secret, payloadStr);

  return `${payloadStr}.${signature}`;
}

/**
 * Cryptographically verifies a demo session token.
 * Validates HMAC signature, expiration time, and role constraints.
 * Fails closed on any tampering, malformed data, or expired timestamp.
 * If DEMO_SESSION_SECRET is missing or invalid in production, fails closed and returns null.
 */
export async function verifyDemoSessionToken(token: string | undefined | null): Promise<DemoSessionPayload | null> {
  if (!token || typeof token !== "string") return null;
  if (!isDemoModeEnabled()) return null;

  const secret = getDemoSessionSecret();
  if (!secret) {
    // If secret is missing or invalid in production, fail closed immediately
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    // In local development ONLY, allow legacy mock cookie values ("1" or "true")
    // for backward compatibility with development test fixtures.
    // In production, unsigned cookies are STRICTLY rejected.
    if (process.env.NODE_ENV !== "production" && (token === "1" || token === "true")) {
      const now = Math.floor(Date.now() / 1000);
      return {
        sub: DEMO_USER.id,
        email: DEMO_USER.email,
        fullName: DEMO_USER.fullName,
        organization: DEMO_USER.organization,
        role: "editor",
        isDemo: true,
        iat: now,
        exp: now + DEMO_SESSION_MAX_AGE,
      };
    }
    return null;
  }

  const [payloadStr, signature] = parts;
  if (!payloadStr || !signature) return null;

  try {
    const isValidSignature = await verifyHmac(secret, payloadStr, signature);
    if (!isValidSignature) {
      return null;
    }

    const payload = JSON.parse(base64UrlToString(payloadStr)) as DemoSessionPayload;

    const now = Math.floor(Date.now() / 1000);
    // Expiration check
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return null;
    }

    // Issued-at sanity check (allow up to 60s future clock skew)
    if (typeof payload.iat !== "number" || payload.iat > now + 60) {
      return null;
    }

    // Role and identity validation: strictly editor role, isDemo true, valid email
    if (
      payload.role !== "editor" ||
      payload.isDemo !== true ||
      !payload.email ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates whether candidate credentials match the configured demo credentials.
 */
export function validateDemoCredentials(email: string, password: string): boolean {
  const configuredEmail = process.env.DEMO_USER_EMAIL || DEFAULT_DEMO_CREDENTIALS.email;
  const configuredPassword = process.env.DEMO_USER_PASSWORD || DEFAULT_DEMO_CREDENTIALS.password;

  const cleanEmail = email.trim().toLowerCase();
  const cleanTarget = configuredEmail.trim().toLowerCase();

  return cleanEmail === cleanTarget && password === configuredPassword;
}
