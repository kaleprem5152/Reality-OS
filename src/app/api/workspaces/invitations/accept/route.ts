import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth-server";
import {
  acceptWorkspaceInvitation,
  getInvitationPreview,
} from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/invitations/accept?token=<rawToken>
 * Safe preview endpoint. Retrieves workspace name and role metadata
 * without consuming or altering the single-use token.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || !token.trim()) {
    return NextResponse.json(
      { valid: false, error: "Invitation token parameter is required." },
      { status: 400 },
    );
  }

  const preview = await getInvitationPreview(token);
  if (!preview.valid) {
    return NextResponse.json(preview, { status: 404 });
  }

  return NextResponse.json(preview, { status: 200 });
}

/**
 * POST /api/workspaces/invitations/accept
 * Body: { token: string }
 *
 * Atomically validates and accepts a workspace invitation.
 * Security enforcement:
 * 1. Requires authenticated session (HTTP 401 if unauthenticated).
 * 2. Compares authenticated user's email against invitation email (HTTP 403 if mismatch).
 * 3. Enforces single-use status (HTTP 410 if already accepted or revoked).
 * 4. Enforces expiration check (HTTP 410 if expiresAt <= now()).
 * 5. Role is strictly assigned from the stored invitation row; caller cannot escalate role.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  const auth = await getServerAuth({ bearerToken });

  if (auth.status !== "authenticated") {
    return NextResponse.json(
      { error: "Authentication required to accept an invitation. Please log in." },
      { status: 401 },
    );
  }

  let body: { token?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
  }

  const result = await acceptWorkspaceInvitation(auth.user, token);

  if (!result.success) {
    let status = 400;
    if (result.code === "INVALID_TOKEN") status = 404;
    else if (result.code === "EMAIL_MISMATCH") status = 403;
    else if (result.code === "EXPIRED" || result.code === "INACTIVE") status = 410;
    else if (result.code === "DATABASE_ERROR") status = 500;

    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    workspaceId: result.workspaceId,
    role: result.role,
    alreadyMember: result.alreadyMember,
  });
}
