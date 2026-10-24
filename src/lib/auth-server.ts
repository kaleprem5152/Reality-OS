import { cookies } from "next/headers";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DEMO_USER, formatSupabaseUser, type AuthProfile } from "@/lib/authStore";

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
 * Result returned when demo mode is explicitly permitted (strictly non-production, unconfigured Supabase only).
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
   * Whether to allow demo fallback when Supabase is not configured in local development.
   * Default: true in non-production when Supabase is unconfigured.
   * Has NO effect in production or whenever Supabase is configured.
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
 *    - Must validate session cryptographically via `supabase.auth.getUser()`.
 *    - If validation fails, throws, or client is null, it ALWAYS fails closed (`status: "unauthenticated"`).
 *    - Demo mode is 100% disabled. No overrides, flags, or cookies can bypass this.
 * 2. When Supabase is NOT configured:
 *    - In production: Always fails closed (`status: "unauthenticated"`).
 *    - In non-production (local development): Permits `status: "demo"` if the demo cookie is present.
 * 3. In `status: "demo"`, `user` is strictly `null` and `isDemo: true`, preventing demo identities
 *    from being used in database foreign keys or treated as verified Supabase users.
 */
export async function getServerAuth(options: GetServerAuthOptions = {}): Promise<ServerAuthResult> {
  const isConfigured = isSupabaseConfigured();
  const isProduction = process.env.NODE_ENV === "production";

  // 1. When Supabase is configured: strictly validate session via Supabase Auth
  if (isConfigured) {
    try {
      const supabase = await createServerSupabaseClient();
      if (!supabase) {
        return {
          status: "unauthenticated",
          user: null,
          profile: null,
          isDemo: false,
          reason: "Supabase client initialization failed.",
        };
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(options.bearerToken || undefined);

      if (error || !user) {
        return {
          status: "unauthenticated",
          user: null,
          profile: null,
          isDemo: false,
          reason: error?.message || "Invalid or expired Supabase session.",
        };
      }

      return {
        status: "authenticated",
        user,
        profile: formatSupabaseUser(user),
        isDemo: false,
      };
    } catch (err) {
      console.error("Failed to validate Supabase server session:", err);
      return {
        status: "unauthenticated",
        user: null,
        profile: null,
        isDemo: false,
        reason: "Authentication verification encountered an unexpected error.",
      };
    }
  }

  // 2. When Supabase is NOT configured:
  // In production, fail closed immediately. Demo mode is never allowed in production.
  if (isProduction) {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
      isDemo: false,
      reason: "Authentication service is not configured in production environment.",
    };
  }

  // 3. Local development fallback (Supabase unconfigured, non-production only)
  const allowDemo = options.allowDemo ?? true;
  if (!allowDemo) {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
      isDemo: false,
      reason: "Demo access is explicitly disabled by caller options.",
    };
  }

  try {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get("realityos_demo_session")?.value;

    if (demoCookie === "1" || demoCookie === "true") {
      return {
        status: "demo",
        user: null,
        profile: DEMO_USER,
        isDemo: true,
      };
    }
  } catch {
    // cookies() unavailable in non-request contexts
  }

  return {
    status: "unauthenticated",
    user: null,
    profile: null,
    isDemo: false,
    reason: "No active Supabase session or demo cookie present.",
  };
}
