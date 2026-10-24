import { NextRequest, NextResponse } from "next/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getServerAuth, type GetServerAuthOptions } from "@/lib/auth-server";
import {
  resolveUserWorkspace,
  type ResolvedMembership,
  type VirtualDemoWorkspace,
} from "@/lib/workspace-server";
import type { WorkspaceRole } from "@/db/schema";
import type { AuthProfile } from "@/lib/authStore";

/**
 * Result returned for an authenticated Supabase user with an authorized workspace membership.
 */
export interface AuthenticatedApiAuthContext {
  status: "authenticated";
  user: SupabaseUser;
  profile: AuthProfile;
  workspace: ResolvedMembership;
  allMemberships: ResolvedMembership[];
  isDemo: false;
  role: WorkspaceRole;
}

/**
 * Result returned for local/offline development demo mode.
 * Strictly isolated: user is null and cannot be treated as a database UUID.
 */
export interface DemoApiAuthContext {
  status: "demo";
  user: null;
  profile: AuthProfile;
  workspace: VirtualDemoWorkspace;
  isDemo: true;
  role: "editor";
}

/**
 * Result returned when authentication is missing or invalid.
 */
export interface UnauthenticatedApiAuthContext {
  status: "unauthenticated";
  user: null;
  profile: null;
  workspace: null;
  isDemo: false;
  reason: string;
}

/**
 * Result returned when caller does not have access to the requested workspace.
 */
export interface ForbiddenApiAuthContext {
  status: "forbidden";
  user: SupabaseUser | null;
  profile: AuthProfile | null;
  workspace: null;
  isDemo: false;
  reason: string;
}

/**
 * Result returned when an authenticated user has not joined or created any workspace.
 */
export interface NoWorkspaceApiAuthContext {
  status: "no_workspace";
  user: SupabaseUser;
  profile: AuthProfile;
  workspace: null;
  isDemo: false;
  reason: string;
}

/**
 * Result returned when an internal or database error prevents resolution.
 */
export interface ErrorApiAuthContext {
  status: "error";
  user: null;
  profile: null;
  workspace: null;
  isDemo: false;
  reason: string;
}

/**
 * Discriminated union of all possible API authentication and workspace resolution results.
 */
export type ApiAuthResult =
  | AuthenticatedApiAuthContext
  | DemoApiAuthContext
  | UnauthenticatedApiAuthContext
  | ForbiddenApiAuthContext
  | NoWorkspaceApiAuthContext
  | ErrorApiAuthContext;

export interface AuthenticateApiOptions extends GetServerAuthOptions {
  /**
   * Explicit workspace ID override. If omitted, extracted from request header or query param.
   */
  requestedWorkspaceId?: string;
}

/**
 * Extracts and trims the requested workspace ID from request headers or query parameters.
 * Priority:
 * 1. 'x-workspace-id' header
 * 2. 'workspaceId' query parameter
 * 3. 'workspace_id' query parameter
 *
 * Empty or whitespace-only values are treated as undefined.
 */
export function extractRequestedWorkspaceId(req: NextRequest | Request): string | undefined {
  const headerVal = req.headers.get("x-workspace-id");
  if (headerVal && headerVal.trim().length > 0) {
    return headerVal.trim();
  }

  if ("nextUrl" in req && req.nextUrl?.searchParams) {
    const param =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.nextUrl.searchParams.get("workspace_id");
    if (param && param.trim().length > 0) {
      return param.trim();
    }
  } else if ("url" in req && req.url) {
    try {
      const url = new URL(req.url);
      const param =
        url.searchParams.get("workspaceId") || url.searchParams.get("workspace_id");
      if (param && param.trim().length > 0) {
        return param.trim();
      }
    } catch {
      // Ignore URL parsing errors and return undefined
    }
  }

  return undefined;
}

/**
 * Authenticates an incoming API route request and resolves its authorized workspace.
 *
 * IMPORTANT SECURITY ARCHITECTURE:
 * - Calling this helper alone does NOT secure database access. Route handlers MUST:
 *   1. Branch on `auth.status === "demo"` and route exclusively to `memoryStore` before touching `db`.
 *   2. For authenticated requests, explicitly scope all queries to `where(eq(table.workspaceId, auth.workspace.workspaceId))`.
 *   3. Enforce author-level checks (e.g. `canDeleteRecord`) before deleting projects or reports.
 *
 * Rules:
 * - Cryptographically verifies Supabase session via `auth.getUser()`. Never trusts client-sent user IDs or localStorage.
 * - Demo mode is strictly rejected in production and when Supabase is configured.
 * - Demo mode returns `user: null` and virtual demo workspace context without querying PostgreSQL.
 * - Fails closed on any unexpected error or unverified token.
 */
export async function authenticateApiRequest(
  req: NextRequest | Request,
  options: AuthenticateApiOptions = {},
): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  const auth = await getServerAuth({
    allowDemo: options.allowDemo,
    bearerToken: options.bearerToken || bearerToken,
  });

  if (auth.status === "unauthenticated") {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
      workspace: null,
      isDemo: false,
      reason: auth.reason,
    };
  }

  const requestedWorkspaceId =
    options.requestedWorkspaceId?.trim() || extractRequestedWorkspaceId(req);

  const workspaceRes = await resolveUserWorkspace(auth, requestedWorkspaceId);

  switch (workspaceRes.status) {
    case "authenticated":
      return {
        status: "authenticated",
        user: workspaceRes.user,
        profile: workspaceRes.profile,
        workspace: workspaceRes.workspace,
        allMemberships: workspaceRes.allMemberships,
        isDemo: false,
        role: workspaceRes.workspace.role,
      };

    case "demo":
      return {
        status: "demo",
        user: null,
        profile: workspaceRes.profile,
        workspace: workspaceRes.workspace,
        isDemo: true,
        role: "editor",
      };

    case "forbidden":
      return {
        status: "forbidden",
        user: auth.status === "authenticated" ? auth.user : null,
        profile: auth.status === "authenticated" ? auth.profile : null,
        workspace: null,
        isDemo: false,
        reason: workspaceRes.reason,
      };

    case "no_workspace":
      return {
        status: "no_workspace",
        user: workspaceRes.user,
        profile: workspaceRes.profile,
        workspace: null,
        isDemo: false,
        reason: workspaceRes.reason,
      };

    case "unauthenticated":
      return {
        status: "unauthenticated",
        user: null,
        profile: null,
        workspace: null,
        isDemo: false,
        reason: workspaceRes.reason,
      };

    case "error":
    default:
      return {
        status: "error",
        user: null,
        profile: null,
        workspace: null,
        isDemo: false,
        reason: workspaceRes.reason || "Failed to resolve workspace membership.",
      };
  }
}

/**
 * Checks whether the request has read permissions.
 * Allowed for all authenticated workspace members (viewer, editor, admin, owner)
 * and sandboxed local demo users.
 */
export function canRead(auth: ApiAuthResult): boolean {
  return auth.status === "authenticated" || auth.status === "demo";
}

/**
 * Checks whether the request has write permissions (create/update).
 * Allowed for editor, admin, owner, and sandboxed demo users (within memory store).
 * Viewers are strictly read-only and return false.
 */
export function canWrite(auth: ApiAuthResult): boolean {
  if (auth.status === "demo") return true;
  if (auth.status === "authenticated") {
    return (
      auth.role === "owner" || auth.role === "admin" || auth.role === "editor"
    );
  }
  return false;
}

/**
 * Checks whether the caller can delete ANY record in the workspace,
 * regardless of author.
 * Strictly limited to workspace 'admin' and 'owner'.
 */
export function canDeleteAny(auth: ApiAuthResult): boolean {
  if (auth.status === "authenticated") {
    return auth.role === "owner" || auth.role === "admin";
  }
  return false;
}

/**
 * Checks whether the caller is authorized to delete a specific record:
 * - Admin/Owner: Can delete any record in their authorized workspace.
 * - Editor: Can delete ONLY records where resourceCreatedBy matches their verified user.id.
 * - Viewer: Never allowed to delete (returns false).
 * - Demo: Allowed for sandboxed demo records in memoryStore.
 */
export function canDeleteRecord(
  auth: ApiAuthResult,
  resourceCreatedBy?: string | null,
): boolean {
  if (auth.status === "demo") return true;
  if (auth.status !== "authenticated") return false;

  if (auth.role === "owner" || auth.role === "admin") {
    return true;
  }

  if (auth.role === "editor") {
    return Boolean(resourceCreatedBy && resourceCreatedBy === auth.user.id);
  }

  return false;
}

/**
 * Checks if a role has general write permissions.
 */
export function isWriteRole(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

/**
 * Checks if a role has workspace-wide deletion permissions.
 */
export function isDeleteAnyRole(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Creates a generic JSON 401 Unauthorized response without leaking internal details.
 */
export function jsonUnauthorized(message = "Unauthorized"): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Creates a generic JSON 403 Forbidden response without leaking internal details.
 */
export function jsonForbidden(message = "Forbidden"): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Creates a generic JSON 404 Not Found response.
 */
export function jsonNotFound(message = "Resource not found"): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Creates a generic JSON 500 Internal Server Error response without exposing database errors or stack traces.
 */
export function jsonInternalError(message = "Internal server error"): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Convenience helper to return standard JSON error responses for unauthenticated, forbidden,
 * no_workspace, and error states. Returns null if the request is successfully authenticated or demo.
 */
export function createApiAuthErrorResponse(
  auth: ApiAuthResult,
): NextResponse<{ error: string }> | null {
  switch (auth.status) {
    case "unauthenticated":
      return jsonUnauthorized(auth.reason || "Unauthorized");
    case "forbidden":
      return jsonForbidden("Access to the requested workspace is denied.");
    case "no_workspace":
      return jsonForbidden("No active workspace membership found.");
    case "error":
      return jsonInternalError("An error occurred while authenticating the request.");
    case "authenticated":
    case "demo":
      return null;
  }
}
