import { cookies } from "next/headers";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DEMO_USER, formatSupabaseUser, type AuthProfile } from "@/lib/authStore";
import { verifyDemoSessionToken, DEMO_COOKIE_NAME } from "@/lib/demo-session";

/**
 * Result returned when a genuine, cryptographically verified Supabase session is present.
 */
export interface AuthenticatedResult {
  status: "authenticated";
  user: SupabaseUser;
  profile: AuthProfile;
  isDemo: false;
}

/**
 * Result returned when demo mode is verified (via signed server cookie or local dev fallback).
 * Note: `user` is strictly null so callers cannot treat demo mode as a verified Supabase user ID.
 */
export interface DemoResult {
  status: "demo";
  user: null;
  profile: AuthProfile;
  isDemo: true;
}

/**
 * Result returned when no valid session is present or demo access is disallowed.
 */
export interface UnauthenticatedResult {
  status: "unauthenticated";
  user: null;
  profile: null;
  isDemo: false;
  reason: string;
}

export type ServerAuthResult = AuthenticatedResult | DemoResult | UnauthenticatedResult;

export interface GetServerAuthOptions {
  /**
   * Whether to allow demo fallback when Supabase authentication is not present.
   * Default: true unless explicitly disabled.
   */
  allowDemo?: boolean;
  /**
   * Optional Bearer JWT token extracted from the Authorization header.
   * When provided, passed to supabase.auth.getUser(token) for Bearer token validation.
   */
  bearerToken?: string;
}

/**
 * Server-side authentication validator for Reality.OS.
 *
 * Security Policy:
 * 1. When Supabase is configured:
 *    - Validates session cryptographically via `supabase.auth.getUser()`.
 *    - If genuine Supabase session exists, returns `status: "authenticated"`.
 * 2. Demo Mode Validation:
 *    - When no Supabase session is present, checks for a verified demo session cookie.
 *    - Requires an HMAC-SHA256 cryptographically signed token issued by `/api/auth/demo`.
 *    - In production, unsigned cookies (e.g. '1' or 'true') are strictly rejected.
 * 3. In `status: "demo"`, `user` is strictly `null` and `isDemo: true`, preventing demo identities
 *    from being used in database foreign keys or treated as verified Supabase users.
 * 4. Fails closed on any unexpected error, tampered token, or unverified session.
 */
export async function getServerAuth(options: GetServerAuthOptions = {}): Promise<ServerAuthResult> {
  const isConfigured = isSupabaseConfigured();
  const allowDemo = options.allowDemo ?? true;

  // 1. When Supabase is configured: attempt to validate session via Supabase Auth
  if (isConfigured) {
    try {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(options.bearerToken || undefined);

        if (user && !error) {
          return {
            status: "authenticated",
            user,
            profile: formatSupabaseUser(user),
            isDemo: false,
          };
        }
      }
    } catch {
      // Supabase verification failed; proceed to check for verified demo session if permitted
    }
  }

  // 2. Demo Session Validation (Cryptographically signed, server-verified cookie)
  if (allowDemo) {
    try {
      const cookieStore = await cookies();
      const demoCookie = cookieStore.get(DEMO_COOKIE_NAME)?.value;
      const verified = await verifyDemoSessionToken(demoCookie);

      if (verified) {
        return {
          status: "demo",
          user: null,
          profile: {
            id: verified.sub,
            email: verified.email,
            fullName: verified.fullName,
            organization: verified.organization,
            role: "Lead Infrastructure Planner",
            isDemo: true,
          },
          isDemo: true,
        };
      }
    } catch {
      // cookies() unavailable in non-request contexts
    }
  }

  const isProduction = process.env.NODE_ENV === "production";

  return {
    status: "unauthenticated",
    user: null,
    profile: null,
    isDemo: false,
    reason: !isConfigured && isProduction
      ? "Authentication service is not configured in production environment."
      : isConfigured
        ? "Invalid or expired session. Please sign in."
        : "Authentication service is not configured and no valid demo session is present.",
  };
}
