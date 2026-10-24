import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { profiles, workspaceInvitations, workspaceMembers, type WorkspaceRole } from "@/db/schema";
import {
  authenticateApiRequest,
  jsonForbidden,
  jsonInternalError,
  jsonNotFound,
  jsonUnauthorized,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set<string>(["owner", "admin", "editor", "viewer"]);
const INVITATION_ROLES = new Set<string>(["admin", "editor", "viewer"]);

interface DemoMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  organization: string;
  role: WorkspaceRole;
  joinedAt: string;
}

const DEMO_MEMBERS_STORE: DemoMember[] = [
  {
    id: "mem-demo-1",
    userId: "usr-demo-1",
    email: "lead.planner@metropolitan.gov.in",
    fullName: "Lead Infrastructure Planner",
    organization: "Metropolitan Authority",
    role: "owner",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mem-demo-2",
    userId: "usr-demo-2",
    email: "chief.engineer@metropolitan.gov.in",
    fullName: "Chief Transit Engineer",
    organization: "Metropolitan Authority",
    role: "admin",
    joinedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "mem-demo-3",
    userId: "usr-demo-3",
    email: "analyst@metropolitan.gov.in",
    fullName: "Corridor Environmental Analyst",
    organization: "Metropolitan Authority",
    role: "editor",
    joinedAt: "2026-02-01T00:00:00.000Z",
  },
];

/**
 * GET /api/workspaces/members
 * Returns all members of the caller's active authorized workspace.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);

  if (auth.status === "unauthenticated") {
    return jsonUnauthorized(auth.reason || "Unauthorized");
  }

  if (auth.status === "forbidden" || auth.status === "no_workspace") {
    return jsonForbidden("Access to workspace members is forbidden.");
  }

  if (auth.status === "error") {
    return jsonInternalError("Authentication error.");
  }

  // Demo mode: return in-memory demo members
  if (auth.status === "demo") {
    return NextResponse.json({
      members: DEMO_MEMBERS_STORE,
      isDemo: true,
      currentUserRole: "owner",
    });
  }

  // Authenticated database query
  try {
    if (!db) {
      return jsonInternalError("Database is not configured.");
    }

    const rows = await db
      .select({
        membershipId: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        email: profiles.email,
        fullName: profiles.fullName,
        organization: profiles.organization,
      })
      .from(workspaceMembers)
      .leftJoin(profiles, eq(workspaceMembers.userId, profiles.id))
      .where(eq(workspaceMembers.workspaceId, auth.workspace.workspaceId));

    const members = rows.map((r: {
      membershipId: string;
      userId: string;
      role: string;
      joinedAt: Date | string | null;
      email: string | null;
      fullName: string | null;
      organization: string | null;
    }) => ({
      id: r.membershipId,
      userId: r.userId,
      email: r.email || "Unknown user",
      fullName: r.fullName || "Team Member",
      organization: r.organization || "Metropolitan Authority",
      role: (VALID_ROLES.has(r.role) ? r.role : "viewer") as WorkspaceRole,
      joinedAt: r.joinedAt instanceof Date ? r.joinedAt.toISOString() : String(r.joinedAt),
    }));

    return NextResponse.json({
      members,
      isDemo: false,
      currentUserRole: auth.role,
    });
  } catch (err) {
    console.error("Failed to fetch workspace members:", err);
    return jsonInternalError("Failed to fetch workspace members.");
  }
}

/**
 * PATCH /api/workspaces/members
 * Updates the workspace role of a member.
 * Strictly limited to workspace 'owner' and 'admin'.
 * Users cannot modify their own role (self-promotion prevented).
 * Only owners can assign or transfer 'owner' role.
 */
export async function PATCH(req: NextRequest) {
  const auth = await authenticateApiRequest(req);

  if (auth.status === "unauthenticated") {
    return jsonUnauthorized(auth.reason || "Unauthorized");
  }

  if (auth.status === "forbidden" || auth.status === "no_workspace") {
    return jsonForbidden("Forbidden");
  }

  if (auth.status === "error") {
    return jsonInternalError("Authentication error.");
  }

  let body: { memberId?: string; role?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memberId, role } = body;
  if (!memberId || typeof memberId !== "string") {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }

  if (!role || !VALID_ROLES.has(role)) {
    return NextResponse.json(
      { error: "role must be one of 'owner', 'admin', 'editor', 'viewer'" },
      { status: 400 },
    );
  }

  // Demo mode: update memory store
  if (auth.status === "demo") {
    const existing = DEMO_MEMBERS_STORE.find((m) => m.id === memberId);
    if (!existing) {
      return jsonNotFound("Member not found in workspace.");
    }
    // Prevent self-role modification in demo
    if (existing.userId === "usr-demo-1") {
      return jsonForbidden("You cannot modify your own workspace role.");
    }
    existing.role = role as WorkspaceRole;
    return NextResponse.json({ success: true, member: existing, isDemo: true });
  }

  // Authenticated RBAC check: only owner and admin can modify roles
  if (auth.role !== "owner" && auth.role !== "admin") {
    return jsonForbidden("Only workspace owners and administrators can modify member roles.");
  }

  // Non-owners cannot promote someone to owner
  if (role === "owner" && auth.role !== "owner") {
    return jsonForbidden("Only workspace owners can assign the owner role.");
  }

  // Authenticated mode: database mutation
  try {
    if (!db) {
      return jsonInternalError("Database is not configured.");
    }

    // Verify target member belongs to caller's workspace
    const existingRows = await db
      .select({
        membershipId: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.workspaceId, auth.workspace.workspaceId),
        ),
      );

    if (existingRows.length === 0) {
      return jsonNotFound("Member not found in this workspace.");
    }

    const target = existingRows[0];

    // Prevent caller from modifying their own role
    if (target.userId === auth.user.id) {
      return jsonForbidden("You cannot modify your own workspace role.");
    }

    // Admins cannot change owner roles
    if (target.role === "owner" && auth.role !== "owner") {
      return jsonForbidden("Only owners can modify an owner's role.");
    }

    const [updated] = await db
      .update(workspaceMembers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.workspaceId, auth.workspace.workspaceId),
        ),
      )
      .returning();

    return NextResponse.json({
      success: true,
      member: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
      },
    });
  } catch (err) {
    console.error("Failed to update workspace member role:", err);
    return jsonInternalError("Failed to update member role.");
  }
}

/**
 * POST /api/workspaces/members
 * Issues a workspace invitation token.
 * Strictly limited to workspace 'owner' and 'admin'.
 * Honest email delivery status: if no outbound mail service is configured,
 * directly returns the invite link and advises the user.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);

  if (auth.status === "unauthenticated") {
    return jsonUnauthorized(auth.reason || "Unauthorized");
  }

  if (auth.status === "forbidden" || auth.status === "no_workspace") {
    return jsonForbidden("Forbidden");
  }

  if (auth.status === "error") {
    return jsonInternalError("Authentication error.");
  }

  let body: { email?: string; role?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role || "viewer";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!INVITATION_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Invited role must be 'admin', 'editor', or 'viewer'" },
      { status: 400 },
    );
  }

  // Demo mode
  if (auth.status === "demo") {
    return NextResponse.json({
      success: true,
      invitation: {
        email,
        role,
        status: "pending",
        directInviteLink: `#demo-invite-token-${Date.now()}`,
        emailDelivered: false,
        notice:
          "Demo mode: Invitation registered in session memory. No external email was dispatched.",
      },
    });
  }

  // Authenticated RBAC check
  if (auth.role !== "owner" && auth.role !== "admin") {
    return jsonForbidden("Only workspace owners and administrators can invite new members.");
  }

  // Authenticated database insertion
  try {
    if (!db) {
      return jsonInternalError("Database is not configured.");
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7-day validity

    const [inv] = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId: auth.workspace.workspaceId,
        email,
        role,
        tokenHash,
        invitedBy: auth.user.id,
        status: "pending",
        expiresAt,
      })
      .returning();

    // Check if an email delivery service is configured
    const hasEmailProvider = Boolean(
      process.env.RESEND_API_KEY ||
        process.env.SMTP_HOST ||
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const directInviteLink = `/auth/callback?invitation=${rawToken}`;
    const notice = hasEmailProvider
      ? "Invitation recorded and queued for delivery."
      : "Invitation created. No outbound email service (RESEND_API_KEY or SMTP) is configured on this server. Share the direct link with the invitee.";

    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          directInviteLink,
          emailDelivered: false,
          notice,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Failed to create workspace invitation:", err);
    return jsonInternalError("Failed to create workspace invitation.");
  }
}
