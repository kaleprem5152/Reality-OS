import { NextRequest } from "next/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { WorkspaceRole } from "@/db/schema";
import type { AuthProfile } from "@/lib/authStore";
import type { ResolvedMembership, VirtualDemoWorkspace } from "@/lib/workspace-server";
import type {
  AuthenticatedApiAuthContext,
  DemoApiAuthContext,
  UnauthenticatedApiAuthContext,
  ForbiddenApiAuthContext,
  NoWorkspaceApiAuthContext,
} from "@/lib/api-auth";

/**
 * Creates a complete, typed Supabase User object for test contexts.
 */
export function createMockSupabaseUser(overrides: Partial<SupabaseUser> = {}): SupabaseUser {
  const now = new Date().toISOString();
  return {
    id: "usr-mock-1",
    app_metadata: {},
    user_metadata: { full_name: "Mock User", organization: "Metropolitan Authority" },
    aud: "authenticated",
    confirmation_sent_at: now,
    recovery_sent_at: now,
    email_change_sent_at: now,
    new_email: "",
    invited_at: now,
    action_link: "",
    email: "user@realityos.test",
    phone: "",
    created_at: now,
    confirmed_at: now,
    email_confirmed_at: now,
    phone_confirmed_at: now,
    last_sign_in_at: now,
    role: "authenticated",
    updated_at: now,
    identities: [],
    is_anonymous: false,
    factors: [],
    ...overrides,
  };
}

/**
 * Creates an AuthProfile for test contexts.
 */
export function createMockAuthProfile(overrides: Partial<AuthProfile> = {}): AuthProfile {
  return {
    id: "usr-mock-1",
    email: "user@realityos.test",
    fullName: "Mock User",
    organization: "Metropolitan Authority",
    role: "Lead Infrastructure Planner",
    isDemo: false,
    ...overrides,
  };
}

/**
 * Creates a ResolvedMembership representing authorized workspace access.
 */
export function createMockMembership(overrides: Partial<ResolvedMembership> = {}): ResolvedMembership {
  return {
    membershipId: "mem-mock-1",
    workspaceId: "ws-mock-alpha",
    workspaceName: "Alpha Authority Workspace",
    role: "editor",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    workspaceCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Creates a virtual demo workspace representation for offline demo tests.
 */
export function createMockVirtualDemoWorkspace(): VirtualDemoWorkspace {
  return {
    workspaceId: "demo-workspace",
    workspaceName: "Demonstration Authority Workspace",
    role: "editor",
  };
}

/**
 * Creates a verified AuthenticatedApiAuthContext with specific workspace role.
 */
export function createMockAuthenticatedContext(
  role: WorkspaceRole = "editor",
  options: {
    userId?: string;
    workspaceId?: string;
    email?: string;
    allMemberships?: ResolvedMembership[];
  } = {},
): AuthenticatedApiAuthContext {
  const userId = options.userId || "usr-mock-1";
  const workspaceId = options.workspaceId || "ws-mock-alpha";
  const email = options.email || "user@realityos.test";

  const user = createMockSupabaseUser({ id: userId, email });
  const profile = createMockAuthProfile({ id: userId, email });
  const workspace = createMockMembership({ workspaceId, role });
  const allMemberships = options.allMemberships || [workspace];

  return {
    status: "authenticated",
    user,
    profile,
    workspace,
    allMemberships,
    isDemo: false,
    role,
  };
}

/**
 * Creates a DemoApiAuthContext strictly isolated with user: null and isDemo: true.
 */
export function createMockDemoContext(): DemoApiAuthContext {
  return {
    status: "demo",
    user: null,
    profile: {
      id: "demo-user",
      email: "demo@realityos.internal",
      fullName: "Demo Planner",
      organization: "Metropolitan Authority (Demo)",
      role: "Lead Infrastructure Planner",
      isDemo: true,
    },
    workspace: createMockVirtualDemoWorkspace(),
    isDemo: true,
    role: "editor",
  };
}

/**
 * Creates an UnauthenticatedApiAuthContext.
 */
export function createMockUnauthenticatedContext(
  reason = "Invalid or expired Supabase session.",
): UnauthenticatedApiAuthContext {
  return {
    status: "unauthenticated",
    user: null,
    profile: null,
    workspace: null,
    isDemo: false,
    reason,
  };
}

/**
 * Creates a ForbiddenApiAuthContext.
 */
export function createMockForbiddenContext(
  reason = "Access to the requested workspace is denied.",
): ForbiddenApiAuthContext {
  return {
    status: "forbidden",
    user: null,
    profile: null,
    workspace: null,
    isDemo: false,
    reason,
  };
}

/**
 * Creates a NoWorkspaceApiAuthContext.
 */
export function createMockNoWorkspaceContext(
  user = createMockSupabaseUser(),
): NoWorkspaceApiAuthContext {
  return {
    status: "no_workspace",
    user,
    profile: createMockAuthProfile({ id: user.id, email: user.email }),
    workspace: null,
    isDemo: false,
    reason: "User has not joined or created any workspace.",
  };
}

export interface MockNextRequestOptions {
  url?: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: unknown;
  bearerToken?: string;
  demoSession?: boolean;
  workspaceId?: string;
}

/**
 * Constructs a NextRequest configured with headers, cookies, tokens, and payloads for security testing.
 */
export function createMockNextRequest(options: MockNextRequestOptions = {}): NextRequest {
  const url = options.url || "http://localhost:3000/api/projects";
  const headers = new Headers(options.headers || {});

  if (options.bearerToken) {
    headers.set("authorization", `Bearer ${options.bearerToken}`);
  }

  if (options.workspaceId) {
    headers.set("x-workspace-id", options.workspaceId);
  }

  const cookieList: string[] = [];
  if (options.demoSession) {
    cookieList.push("realityos_demo_session=1");
  }
  if (options.cookies) {
    for (const [k, v] of Object.entries(options.cookies)) {
      cookieList.push(`${k}=${encodeURIComponent(v)}`);
    }
  }
  if (cookieList.length > 0) {
    headers.set("cookie", cookieList.join("; "));
  }

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined && options.method !== "GET") {
    if (typeof options.body === "string") {
      init.body = options.body;
    } else {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(options.body);
    }
  }

  return new NextRequest(new Request(url, init));
}
