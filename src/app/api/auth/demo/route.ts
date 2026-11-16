import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_COOKIE_NAME,
  DEMO_SESSION_MAX_AGE,
  createDemoSessionToken,
  getDemoSessionSecret,
  isDemoModeEnabled,
  validateDemoCredentials,
  verifyDemoSessionToken,
} from "@/lib/demo-session";
import { DEMO_USER, type AuthProfile } from "@/lib/authStore";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/demo
 * Authenticates demo access and issues a cryptographically signed, HTTP-only cookie.
 * Supports:
 * 1. Credentials login: { email, password }
 * 2. 1-Click bypass login: { is1Click: true }
 */
export async function POST(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      { error: "Demo authentication is disabled in this environment." },
      { status: 403 },
    );
  }

  // Production security check: DEMO_SESSION_SECRET must be configured and valid
  const secret = getDemoSessionSecret();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Demo authentication is currently unavailable: DEMO_SESSION_SECRET is not configured or does not meet security requirements in production.",
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const is1Click = Boolean(body.is1Click);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  let userProfile: AuthProfile;

  if (is1Click) {
    userProfile = {
      ...DEMO_USER,
      isDemo: true,
    };
  } else if (email && password) {
    const isValid = validateDemoCredentials(email, password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid demo credentials. Please check your email and password." },
        { status: 401 },
      );
    }
    userProfile = {
      ...DEMO_USER,
      email: email.toLowerCase(),
      isDemo: true,
    };
  } else {
    return NextResponse.json(
      { error: "Missing credentials or 1-click demo flag." },
      { status: 400 },
    );
  }

  const token = await createDemoSessionToken(userProfile);
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Demo authentication is currently unavailable: Failed to generate a secure session token.",
      },
      { status: 503 },
    );
  }

  const isProduction = process.env.NODE_ENV === "production";

  const response = NextResponse.json({
    success: true,
    user: userProfile,
  });

  response.cookies.set(DEMO_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE,
  });

  return response;
}

/**
 * GET /api/auth/demo
 * Verifies if the client currently holds a valid, unexpired demo session.
 */
export async function GET(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ authenticated: false, reason: "Demo mode disabled" }, { status: 403 });
  }

  const secret = getDemoSessionSecret();
  if (!secret) {
    return NextResponse.json(
      {
        authenticated: false,
        error:
          "Demo authentication is currently unavailable: DEMO_SESSION_SECRET is not configured or does not meet security requirements in production.",
      },
      { status: 503 },
    );
  }

  const cookieVal = req.cookies.get(DEMO_COOKIE_NAME)?.value;
  const verified = await verifyDemoSessionToken(cookieVal);

  if (!verified) {
    return NextResponse.json(
      { authenticated: false, error: "No active or valid demo session." },
      { status: 401 },
    );
  }

  const userProfile: AuthProfile = {
    id: verified.sub,
    email: verified.email,
    fullName: verified.fullName,
    organization: verified.organization,
    role: "Lead Infrastructure Planner",
    isDemo: true,
  };

  return NextResponse.json({
    authenticated: true,
    user: userProfile,
  });
}

/**
 * DELETE /api/auth/demo
 * Clears the HTTP-only demo session cookie (Logout).
 */
export async function DELETE() {
  const isProduction = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ success: true });

  response.cookies.set(DEMO_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
