import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./client";
import { getSafeRedirectUrl } from "../redirect";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  let user = null;

  if (isSupabaseConfigured()) {
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

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  }

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/auth");

  const isPublicMarketingRoute =
    pathname === "/" ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms");

  const isPublicApiRoute =
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/ai/status");

  // Redirect authenticated users away from login/signup to destination or /overview
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const nextUrl = request.nextUrl.clone();
    const rawRedirect = request.nextUrl.searchParams.get("redirect");
    nextUrl.pathname = getSafeRedirectUrl(rawRedirect, "/overview");
    nextUrl.search = "";
    return NextResponse.redirect(nextUrl);
  }

  // Protect internal app routes if user has neither Supabase session nor explicit demo mode
  if (!user && !isAuthRoute && !isPublicMarketingRoute && !isPublicApiRoute) {
    const demoCookie = request.cookies.get("realityos_demo_session")?.value;
    if (demoCookie === "1" || demoCookie === "true") {
      return supabaseResponse;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
