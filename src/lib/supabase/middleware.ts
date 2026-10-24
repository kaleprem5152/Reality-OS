import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./client";
import { getSafeRedirectUrl } from "../redirect";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  let user = null;
  const isConfigured = isSupabaseConfigured();
  const isProduction = process.env.NODE_ENV === "production";

  if (isConfigured) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
              supabaseResponse = NextResponse.next({
                request,
              });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const authHeader = request.headers.get("authorization");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : undefined;

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser(bearerToken || undefined);
      user = authUser;
    } catch {
      user = null;
    }
  }

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth");

  const isPublicMarketingRoute =
    pathname === "/" ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms");

  const isPublicApiRoute =
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/ai/status");

  const isApiRoute = pathname.startsWith("/api/");

  // Demo access is strictly limited to non-production environments when Supabase is unconfigured.
  // Never trust demo cookies in production or whenever Supabase is configured.
  const allowDemo = !isProduction && !isConfigured;
  const demoCookie = request.cookies.get("realityos_demo_session")?.value;
  const isDemo = allowDemo && (demoCookie === "1" || demoCookie === "true");

  // Redirect authenticated users away from login/signup to destination or /overview
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const nextUrl = request.nextUrl.clone();
    const rawRedirect = request.nextUrl.searchParams.get("redirect");
    nextUrl.pathname = getSafeRedirectUrl(rawRedirect, "/overview");
    nextUrl.search = "";
    return NextResponse.redirect(nextUrl);
  }

  // Allow public API routes (health check, AI status) to pass through unconditionally
  if (isPublicApiRoute) {
    return supabaseResponse;
  }

  // Handle unauthenticated requests (neither verified Supabase user nor permitted demo session)
  if (!user && !isDemo) {
    // 1. API routes: return JSON 401 Unauthorized (never 307 redirect to /login)
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Allow public browser routes (auth flows, landing, legal pages)
    if (isAuthRoute || isPublicMarketingRoute) {
      return supabaseResponse;
    }

    // 3. Protected browser pages: redirect to /login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
