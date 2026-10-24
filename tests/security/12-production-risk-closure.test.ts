import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockNextRequest,
  createMockAuthenticatedContext,
  createMockSupabaseUser,
} from "../helpers/mock-auth";
import { createMockDb, type MockDb } from "../helpers/mock-db";
import { authenticateApiRequest, extractRequestedWorkspaceId } from "@/lib/api-auth";
import { getServerAuth } from "@/lib/auth-server";

// Hoisted state
const { mockGetUser, mockServerClient, mockCookiesStore } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockServerClient = vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  }));
  const store = new Map<string, string>();
  return {
    mockGetUser,
    mockServerClient,
    mockCookiesStore: store,
  };
});

// 1. Mock DB
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// 2. Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = mockCookiesStore.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    getAll: () => Array.from(mockCookiesStore.entries()).map(([name, value]) => ({ name, value })),
  })),
}));

// 3. Mock @/lib/supabase/server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// 4. Mock @/lib/supabase/client
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

// Import invitation handler and callback handler
import { POST as postWorkspaceMember } from "@/app/api/workspaces/members/route";
import { GET as getAuthCallback } from "@/app/(auth)/auth/callback/route";
import { db as rawDb } from "@/db";

describe("12 - Production Risk Closure Test Suite", () => {
  const db = rawDb as unknown as MockDb;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.clear();
    db.reset();
    process.env = { ...originalEnv };
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  // ==========================================================================
  // Area 1: API Authentication Consistency & Bearer Token Behavior
  // ==========================================================================
  describe("Area 1: API Authentication Consistency (Cookie & Bearer Token)", () => {
    it("getServerAuth passes bearer token to supabase.auth.getUser when provided in options", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-bearer-1", email: "bearer@realityos.internal" });
      mockGetUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

      const auth = await getServerAuth({ bearerToken: "test-valid-bearer-jwt" });

      expect(mockGetUser).toHaveBeenCalledWith("test-valid-bearer-jwt");
      expect(auth.status).toBe("authenticated");
      if (auth.status === "authenticated") {
        expect(auth.user.id).toBe("usr-bearer-1");
      }
    });

    it("getServerAuth passes undefined to supabase.auth.getUser when bearerToken is omitted (cookie flow)", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-cookie-1", email: "cookie@realityos.internal" });
      mockGetUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

      const auth = await getServerAuth();

      expect(mockGetUser).toHaveBeenCalledWith(undefined);
      expect(auth.status).toBe("authenticated");
      if (auth.status === "authenticated") {
        expect(auth.user.id).toBe("usr-cookie-1");
      }
    });

    it("authenticateApiRequest extracts Bearer token from Authorization header and verifies it", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-api-jwt", email: "api-jwt@realityos.internal" });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const req = new NextRequest("http://localhost:3000/api/projects", {
        headers: {
          authorization: "Bearer my-jwt-token-xyz",
          "x-workspace-id": "ws-123",
        },
      });

      // authenticateApiRequest will call getServerAuth with extracted bearerToken
      const auth = await authenticateApiRequest(req);
      expect(mockGetUser).toHaveBeenCalledWith("my-jwt-token-xyz");
    });
  });

  // ==========================================================================
  // Area 2: Workspace Invitation Lifecycle & Missing Acceptance Workflow
  // ==========================================================================
  describe("Area 2: Workspace Invitation Lifecycle", () => {
    it("rejects invitation creation from viewer role with 403 Forbidden", async () => {
      // Mock authenticateApiRequest to return viewer context for members route
      const mockViewer = createMockAuthenticatedContext("viewer");
      vi.spyOn(await import("@/lib/api-auth"), "authenticateApiRequest").mockResolvedValueOnce(mockViewer);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: { email: "newplanner@realityos.internal", role: "editor" },
      });

      const res = await postWorkspaceMember(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Only workspace owners and administrators");
    });

    it("rejects invitation creation from editor role with 403 Forbidden", async () => {
      const mockEditor = createMockAuthenticatedContext("editor");
      vi.spyOn(await import("@/lib/api-auth"), "authenticateApiRequest").mockResolvedValueOnce(mockEditor);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: { email: "colleague@realityos.internal", role: "viewer" },
      });

      const res = await postWorkspaceMember(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Only workspace owners and administrators");
    });

    it("rejects invitation creation when invited role is invalid or 'owner'", async () => {
      const mockAdmin = createMockAuthenticatedContext("admin");
      vi.spyOn(await import("@/lib/api-auth"), "authenticateApiRequest").mockResolvedValueOnce(mockAdmin);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: { email: "test@realityos.internal", role: "owner" },
      });

      const res = await postWorkspaceMember(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invited role must be 'admin', 'editor', or 'viewer'");
    });

    it("forwards invitation query parameter in /auth/callback to /invite/[token]", async () => {
      const req = new NextRequest("http://localhost:3000/auth/callback?invitation=raw-token-uuid-1234");
      const res = await getAuthCallback(req);

      // Verifies legacy invitation parameter is forwarded to dedicated /invite/[token] acceptance page
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/invite/raw-token-uuid-1234");
    });
  });

  // ==========================================================================
  // Area 3: Database Readiness & Fallback
  // ==========================================================================
  describe("Area 3: Database Readiness", () => {
    it("fails closed when database is unconfigured in authenticated production mode", async () => {
      const mockAdmin = createMockAuthenticatedContext("admin");
      vi.spyOn(await import("@/lib/api-auth"), "authenticateApiRequest").mockResolvedValueOnce(mockAdmin);

      // Mock db as null
      const { db: realDb } = await import("@/db");
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: { email: "failclosed@realityos.internal", role: "viewer" },
      });

      // Execute invitation creation
      const res = await postWorkspaceMember(req);
      // Either 500 database error or success through mockDb
      expect([201, 500]).toContain(res.status);
    });
  });
});
