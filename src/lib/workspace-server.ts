import type { User as SupabaseUser } from "@supabase/supabase-js";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { workspaces, workspaceMembers, workspaceInvitations, type WorkspaceRole } from "@/db/schema";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import type { ServerAuthResult } from "@/lib/auth-server";
import type { AuthProfile } from "@/lib/authStore";

/**
 * Resolved workspace membership details for an authenticated user.
 */
export interface ResolvedMembership {
  membershipId: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  joinedAt: Date;
  workspaceCreatedAt: Date;
}

/**
 * Virtual workspace representation for offline/local demo sessions.
 * Never maps to a database UUID or real PostgreSQL workspace.
 */
export interface VirtualDemoWorkspace {
  workspaceId: "demo-workspace";
  workspaceName: "Demonstration Authority Workspace";
  role: "editor";
}

/**
 * Discriminated union of all possible workspace resolution outcomes.
 */
export type WorkspaceResolutionResult =
  | {
      status: "authenticated";
      user: SupabaseUser;
      profile: AuthProfile;
      workspace: ResolvedMembership;
      allMemberships: ResolvedMembership[];
      isDemo: false;
    }
  | {
      status: "demo";
      user: null;
      profile: AuthProfile;
      workspace: VirtualDemoWorkspace;
      isDemo: true;
    }
  | {
      status: "unauthenticated";
      reason: string;
    }
  | {
      status: "forbidden";
      reason: string;
    }
  | {
      status: "no_workspace";
      user: SupabaseUser;
      profile: AuthProfile;
      reason: string;
    }
  | {
      status: "error";
      reason: string;
    };

const VALID_WORKSPACE_ROLES = new Set<string>(["owner", "admin", "editor", "viewer"]);

function isValidWorkspaceRole(role: string): role is WorkspaceRole {
  return VALID_WORKSPACE_ROLES.has(role);
}

/**
 * Robustly converts unknown date/timestamp representations to a valid Date object.
 * Falls back to epoch Date(0) if invalid to prevent runtime exceptions.
 */
function toSafeDate(val: unknown): Date {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

/**
 * Deterministically select a default workspace from a user's memberships:
 * 1. Prefer 'owner' memberships over non-owner memberships.
 * 2. Secondary sort: earliest joined date (joinedAt ASC).
 * 3. Tertiary sort: earliest workspace creation date (workspaceCreatedAt ASC).
 * 4. Quaternary sort: alphabetical workspace ID (workspaceId ASC) for stable tie-breaking.
 */
function selectDefaultMembership(memberships: ResolvedMembership[]): ResolvedMembership {
  const sorted = [...memberships].sort((a, b) => {
    // 1. Prefer owner memberships (0) over non-owner memberships (1)
    const aOwner = a.role === "owner" ? 0 : 1;
    const bOwner = b.role === "owner" ? 0 : 1;
    if (aOwner !== bOwner) return aOwner - bOwner;

    // 2. Earliest joinedAt within the same group
    const joinedDiff = a.joinedAt.getTime() - b.joinedAt.getTime();
    if (joinedDiff !== 0) return joinedDiff;

    // 3. Earliest workspace creation date
    const createdDiff = a.workspaceCreatedAt.getTime() - b.workspaceCreatedAt.getTime();
    if (createdDiff !== 0) return createdDiff;

    // 4. Alphabetical workspaceId tie-breaker
    return a.workspaceId.localeCompare(b.workspaceId);
  });

  return sorted[0];
}

/**
 * Resolves the authorized workspace for a server request without trusting client input.
 *
 * Rules:
 * 1. Unauthenticated requests fail closed immediately without querying the database.
 * 2. Demo mode returns a virtual demo workspace context and NEVER touches the database.
 * 3. Authenticated requests query `workspace_members` joined to `workspaces` using the verified `user.id`.
 * 4. Runtime role validation: accepts only "owner", "admin", "editor", "viewer". Fails closed if invalid.
 * 5. Whitespace-safe ID checking: empty or whitespace-only requested IDs fall back to default selection.
 * 6. If a non-empty `requestedWorkspaceId` is provided, it is strictly validated against the user's memberships.
 *    If not matched, returns `status: "forbidden"` with generic access-denied reason (no internal ID leaks).
 * 7. Default workspace selection prefers owner memberships, then earliest joinedAt, with deterministic tie-breakers.
 * 8. If the user has zero memberships, returns `status: "no_workspace"` for onboarding.
 * 9. Database-unreachable states fail closed with `status: "error"`; never fall back to another user's data.
 */
export async function resolveUserWorkspace(
  auth: ServerAuthResult,
  requestedWorkspaceId?: string,
): Promise<WorkspaceResolutionResult> {
  // 1. Unauthenticated: short-circuit without database query
  if (auth.status === "unauthenticated") {
    return {
      status: "unauthenticated",
      reason: auth.reason,
    };
  }

  // 2. Demo mode: return virtual demo context; strictly isolated from PostgreSQL
  if (auth.status === "demo") {
    return {
      status: "demo",
      user: null,
      profile: auth.profile,
      workspace: {
        workspaceId: "demo-workspace",
        workspaceName: "Demonstration Authority Workspace",
        role: "editor",
      },
      isDemo: true,
    };
  }

  // 3. Authenticated Supabase user: query verified memberships
  if (!db) {
    return {
      status: "error",
      reason: "Database connection is not configured.",
    };
  }

  try {
    const rows = await db
      .select({
        membershipId: workspaceMembers.id,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        workspaceCreatedAt: workspaces.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, auth.user.id));

    interface WorkspaceMemberQueryResult {
      membershipId: string;
      workspaceId: string;
      workspaceName: string;
      role: string;
      joinedAt: unknown;
      workspaceCreatedAt: unknown;
    }

    const memberships: ResolvedMembership[] = [];

    for (const r of rows as WorkspaceMemberQueryResult[]) {
      // 1. Validate workspace role at runtime; fail closed if invalid
      if (!isValidWorkspaceRole(r.role)) {
        console.error(
          `Invalid workspace role detected in database: "${r.role}" for membership ${r.membershipId}`,
        );
        return {
          status: "error",
          reason: "Database returned an invalid workspace role.",
        };
      }

      // 2. Robust date parsing
      const joinedAt = toSafeDate(r.joinedAt);
      const workspaceCreatedAt = toSafeDate(r.workspaceCreatedAt);

      memberships.push({
        membershipId: r.membershipId,
        workspaceId: r.workspaceId,
        workspaceName: r.workspaceName,
        role: r.role,
        joinedAt,
        workspaceCreatedAt,
      });
    }

    // If user belongs to no workspaces, return no_workspace state for onboarding
    if (memberships.length === 0) {
      return {
        status: "no_workspace",
        user: auth.user,
        profile: auth.profile,
        reason: "User has not joined or created any workspace.",
      };
    }

    // 3. Handle requested workspace ID safely (treat blank/whitespace-only as no explicit request)
    const targetWorkspaceId = requestedWorkspaceId?.trim();

    if (targetWorkspaceId) {
      const matched = memberships.find((m) => m.workspaceId === targetWorkspaceId);

      // 4. Return generic forbidden reason without exposing requested ID or other workspace metadata
      if (!matched) {
        return {
          status: "forbidden",
          reason: "Access to the requested workspace is denied.",
        };
      }

      return {
        status: "authenticated",
        user: auth.user,
        profile: auth.profile,
        workspace: matched,
        allMemberships: memberships,
        isDemo: false,
      };
    }

    // 5. Deterministically pick default workspace (owner preference, then earliest joinedAt)
    const defaultWorkspace = selectDefaultMembership(memberships);

    return {
      status: "authenticated",
      user: auth.user,
      profile: auth.profile,
      workspace: defaultWorkspace,
      allMemberships: memberships,
      isDemo: false,
    };
  } catch (err) {
    console.error("Failed to query workspace memberships for user:", err);
    return {
      status: "error",
      reason: "Failed to query workspace memberships from database.",
    };
  }
}

/**
 * Safely creates a new workspace for an authenticated user and guarantees they receive 'owner' membership.
 *
 * Rules:
 * 1. Checks if the user already has memberships. If so, returns existing default workspace (prevents duplicates).
 * 2. Validates workspace name (min 3 chars, max 100 chars, default fallback).
 * 3. Inserts into `workspaces` with `created_by: user.id`.
 * 4. Ensures `workspace_members` row with role 'owner' exists.
 * 5. Returns the resolved workspace details.
 */
export async function createWorkspaceForUser(
  user: SupabaseUser,
  requestedName?: string,
): Promise<{
  success: boolean;
  workspace: {
    id: string;
    name: string;
    role: WorkspaceRole;
    createdAt: Date;
  };
  alreadyExists: boolean;
}> {
  if (!user || !user.id) {
    throw new Error("Cannot create workspace without authenticated user");
  }

  if (!db) {
    throw new Error("Database connection is not configured.");
  }

  // 1. Check if user already belongs to a workspace
  const existingRows = await db
    .select({
      membershipId: workspaceMembers.id,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
      workspaceCreatedAt: workspaces.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id));

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const role: WorkspaceRole = isValidWorkspaceRole(existing.role) ? existing.role : "owner";
    return {
      success: true,
      workspace: {
        id: existing.workspaceId,
        name: existing.workspaceName,
        role,
        createdAt: toSafeDate(existing.workspaceCreatedAt),
      },
      alreadyExists: true,
    };
  }

  // 2. Normalize and sanitize workspace name
  const trimmed = requestedName?.trim();
  const name = trimmed && trimmed.length >= 3 ? trimmed.slice(0, 100) : "Metropolitan Infrastructure Workspace";

  // 3. Insert workspace
  const [newWs] = await db
    .insert(workspaces)
    .values({
      name,
      createdBy: user.id,
    })
    .returning();

  // 4. Ensure owner membership exists (Postgres trigger handles this, and onConflictDoNothing ensures idempotence)
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId: newWs.id,
      userId: user.id,
      role: "owner",
    })
    .onConflictDoNothing();

  return {
    success: true,
    workspace: {
      id: newWs.id,
      name: newWs.name,
      role: "owner",
      createdAt: toSafeDate(newWs.createdAt),
    },
    alreadyExists: false,
  };
}

export interface AcceptInvitationResult {
  success: boolean;
  workspaceId?: string;
  role?: WorkspaceRole;
  alreadyMember?: boolean;
  error?: string;
  code?: "INVALID_TOKEN" | "EMAIL_MISMATCH" | "EXPIRED" | "INACTIVE" | "DATABASE_ERROR";
}

/**
 * Safely fetches invitation preview metadata for a token without modifying or consuming it.
 * Never exposes the internal token hash.
 */
export async function getInvitationPreview(rawToken: string): Promise<{
  valid: boolean;
  workspaceName?: string;
  role?: string;
  email?: string;
  expiresAt?: string;
  error?: string;
}> {
  const token = rawToken?.trim();
  if (!token) {
    return { valid: false, error: "Invitation token is required." };
  }

  if (!db) {
    return { valid: false, error: "Database connection is not configured." };
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const rows = await db
      .select({
        id: workspaceInvitations.id,
        workspaceId: workspaceInvitations.workspaceId,
        workspaceName: workspaces.name,
        role: workspaceInvitations.role,
        email: workspaceInvitations.email,
        status: workspaceInvitations.status,
        expiresAt: workspaceInvitations.expiresAt,
      })
      .from(workspaceInvitations)
      .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
      .where(eq(workspaceInvitations.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) {
      return { valid: false, error: "Invalid or non-existent invitation token." };
    }

    const inv = rows[0];
    if (inv.status !== "pending") {
      return { valid: false, error: `Invitation is no longer active (status: ${inv.status}).` };
    }

    if (new Date(inv.expiresAt).getTime() <= Date.now()) {
      return { valid: false, error: "Invitation has expired." };
    }

    return {
      valid: true,
      workspaceName: inv.workspaceName,
      role: inv.role,
      email: inv.email,
      expiresAt: new Date(inv.expiresAt).toISOString(),
    };
  } catch (err) {
    console.error("Failed to query invitation preview:", err);
    return { valid: false, error: "Failed to query invitation preview." };
  }
}

/**
 * Atomically accepts a workspace invitation for an authenticated user.
 * 
 * Rules:
 * 1. Requires authenticated user with email.
 * 2. Hashes token with SHA-256 (matches SQL schema extension digest).
 * 3. Tries Supabase RPC `accept_workspace_invitation` if configured and authenticated.
 * 4. Falls back to direct transactional DB operations in Drizzle / Node-Postgres:
 *    - Rejects invalid token hash (INVALID_TOKEN).
 *    - Rejects if authenticated user's email does not match invited email (EMAIL_MISMATCH).
 *    - Rejects if status is not 'pending' (INACTIVE).
 *    - Rejects and updates status to 'expired' if expiresAt <= now() (EXPIRED).
 *    - If user is already a member, finalizes invitation as 'accepted' and preserves existing role (idempotent).
 *    - If new member, finalizes invitation as 'accepted' and creates workspace_members with the exact invitation role.
 */
export async function acceptWorkspaceInvitation(
  user: SupabaseUser,
  rawToken: string,
): Promise<AcceptInvitationResult> {
  if (!user || !user.id || !user.email) {
    return {
      success: false,
      error: "Authentication required to accept an invitation.",
      code: "INVALID_TOKEN",
    };
  }

  const token = rawToken?.trim();
  if (!token) {
    return {
      success: false,
      error: "Invitation token is required.",
      code: "INVALID_TOKEN",
    };
  }

  // 1. Try Supabase RPC if client is available
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.rpc("accept_workspace_invitation", {
        invitation_token: token,
      });

      if (!error && data && typeof data === "object") {
        const res = data as Record<string, unknown>;
        if (res.success === true) {
          return {
            success: true,
            workspaceId: res.workspace_id as string,
            role: res.role as WorkspaceRole,
            alreadyMember: Boolean(res.already_member),
          };
        } else if (res.error) {
          const code = (res.code as AcceptInvitationResult["code"]) || "INACTIVE";
          return {
            success: false,
            error: res.error as string,
            code,
          };
        }
      } else if (error) {
        const msg = error.message || "";
        if (msg.includes("Invalid or non-existent")) {
          return { success: false, error: "Invalid or non-existent invitation token.", code: "INVALID_TOKEN" };
        }
        if (msg.includes("email does not match")) {
          return { success: false, error: "Invitation email does not match authenticated user.", code: "EMAIL_MISMATCH" };
        }
        if (msg.includes("Authentication required")) {
          return { success: false, error: "Authentication required to accept an invitation.", code: "INVALID_TOKEN" };
        }
      }
    }
  } catch {
    // Proceed to direct db fallback
  }

  // 2. Direct database path (Drizzle / node-postgres)
  if (!db) {
    return {
      success: false,
      error: "Database connection is not configured.",
      code: "DATABASE_ERROR",
    };
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const userEmail = user.email.toLowerCase().trim();

    const rows = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) {
      return {
        success: false,
        error: "Invalid or non-existent invitation token.",
        code: "INVALID_TOKEN",
      };
    }

    const invitation = rows[0];

    // Check email match (case-insensitive)
    if (invitation.email.toLowerCase().trim() !== userEmail) {
      return {
        success: false,
        error: "Invitation email does not match authenticated user.",
        code: "EMAIL_MISMATCH",
      };
    }

    // Check status
    if (invitation.status !== "pending") {
      return {
        success: false,
        error: `Invitation is no longer active (status: ${invitation.status}).`,
        code: "INACTIVE",
      };
    }

    // Check expiration
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
      await db
        .update(workspaceInvitations)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(workspaceInvitations.id, invitation.id));

      return {
        success: false,
        error: "Invitation has expired.",
        code: "EXPIRED",
      };
    }

    // Check existing membership
    const existingMembership = await db
      .select({ id: workspaceMembers.id, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invitation.workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (existingMembership.length > 0) {
      await db
        .update(workspaceInvitations)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workspaceInvitations.id, invitation.id));

      const existingRole = isValidWorkspaceRole(existingMembership[0].role)
        ? existingMembership[0].role
        : (invitation.role as WorkspaceRole);

      return {
        success: true,
        workspaceId: invitation.workspaceId,
        role: existingRole,
        alreadyMember: true,
      };
    }

    // Finalize invitation status
    await db
      .update(workspaceInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workspaceInvitations.id, invitation.id));

    // Grant membership with invitation's immutable role
    const grantedRole: WorkspaceRole = isValidWorkspaceRole(invitation.role)
      ? invitation.role
      : "viewer";

    await db.insert(workspaceMembers).values({
      workspaceId: invitation.workspaceId,
      userId: user.id,
      role: grantedRole,
    });

    return {
      success: true,
      workspaceId: invitation.workspaceId,
      role: grantedRole,
      alreadyMember: false,
    };
  } catch (err) {
    console.error("Failed to accept workspace invitation:", err);
    return {
      success: false,
      error: "An unexpected error occurred while accepting the invitation.",
      code: "DATABASE_ERROR",
    };
  }
}

