import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockSupabaseUser,
  createMockAuthProfile,
  createMockDemoContext,
  createMockUnauthenticatedContext,
  createMockNoWorkspaceContext,
} from "../helpers/mock-auth";
import { createMockDb, type MockDb } from "../helpers/mock-db";
import type { ServerAuthResult } from "@/lib/auth-server";

// Hoisted state shared with vi.mock
const { getApiAuthResult, setApiAuthResult, getServerAuthResult, setServerAuthResult } = vi.hoisted(() => {
  let currentApiAuth: any = null;
  let currentServerAuth: any = null;

  return {
    getApiAuthResult: () => currentApiAuth,
    setApiAuthResult: (r: any) => {
      currentApiAuth = r;
    },
    getServerAuthResult: () => currentServerAuth,
    setServerAuthResult: (r: any) => {
      currentServerAuth = r;
    },
  };
});

// 1. Mock DB to prevent real PostgreSQL connections
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// 2. Mock authenticateApiRequest for GET /api/workspaces
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getApiAuthResult()),
  };
});

// 3. Mock getServerAuth for POST /api/workspaces
vi.mock("@/lib/auth-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-server")>();
  return {
    ...actual,
    getServerAuth: vi.fn(async () => getServerAuthResult()),
  };
});

// Import handlers and utilities under test
import { GET as getWorkspaces, POST as postWorkspaces } from "@/app/api/workspaces/route";
import { createWorkspaceForUser } from "@/lib/workspace-server";
import { db as rawDb } from "@/db";

describe("07 - Workspace Onboarding Security & Provisioning Test Suite", () => {
  const db = rawDb as unknown as MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
  });

  // =========================================================================
  // SECTION 1: Authorization & Unauthenticated Rejection
  // =========================================================================
  describe("Authorization & Unauthenticated Fail-Closed", () => {
    it("POST /api/workspaces fails closed with 401 when unauthenticated", async () => {
      setServerAuthResult({
        status: "unauthenticated",
        user: null,
        profile: null,
        isDemo: false,
        reason: "No active session",
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "POST",
        body: { name: "Metropolitan Transit Lab" },
      });

      const res = await postWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBeDefined();
      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("GET /api/workspaces fails closed with 401 when unauthenticated", async () => {
      setApiAuthResult(createMockUnauthenticatedContext("No active session"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "GET",
      });
      const res = await getWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBeDefined();
    });

    it("GET /api/workspaces returns empty list for authenticated user with no workspace", async () => {
      setApiAuthResult(createMockNoWorkspaceContext());

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "GET",
      });
      const res = await getWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.workspaces).toEqual([]);
    });
  });

  // =========================================================================
  // SECTION 2: Demo Mode Isolation
  // =========================================================================
  describe("Demo Mode Isolation", () => {
    it("POST /api/workspaces in demo mode returns virtual workspace without PostgreSQL queries", async () => {
      setServerAuthResult({
        status: "demo",
        user: null,
        profile: createMockAuthProfile({ isDemo: true }),
        isDemo: true,
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "POST",
        body: { name: "Demo Workspace Name" },
      });

      const res = await postWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.workspace.id).toBe("demo-workspace");
      expect(json.alreadyExists).toBe(true);
      // Ensure zero database queries were executed
      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("GET /api/workspaces in demo mode returns virtual demo workspace without touching DB", async () => {
      setApiAuthResult(createMockDemoContext());

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "GET",
      });
      const res = await getWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.workspaces).toHaveLength(1);
      expect(json.workspaces[0].id).toBe("demo-workspace");
      expect(db.getExecutedQueries().length).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 3: Workspace Creation & Owner Role Assignment
  // =========================================================================
  describe("Workspace Creation & Owner Role Assignment", () => {
    it("POST /api/workspaces creates workspace and assigns owner role to creator", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-creator-42", email: "planner@city.gov" });
      const mockProfile = createMockAuthProfile({
        id: "usr-creator-42",
        email: "planner@city.gov",
        organization: "Dept of Transportation",
      });

      setServerAuthResult({
        status: "authenticated",
        user: mockUser,
        profile: mockProfile,
        isDemo: false,
      });

      // DB Queue:
      // 1. Check existing: return empty array []
      // 2. Insert workspace returning: return new workspace
      // 3. Insert membership: return []
      db.queueResults(
        [], // existing check
        [
          {
            id: "ws-new-prov-1",
            name: "Regional Mobility Hub",
            createdBy: "usr-creator-42",
            createdAt: new Date("2026-03-01T12:00:00Z"),
            updatedAt: new Date("2026-03-01T12:00:00Z"),
          },
        ],
        [], // member insert
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "POST",
        body: { name: "Regional Mobility Hub" },
      });

      const res = await postWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.workspace.id).toBe("ws-new-prov-1");
      expect(json.workspace.name).toBe("Regional Mobility Hub");
      expect(json.workspace.role).toBe("owner");
      expect(json.alreadyExists).toBe(false);

      const executed = db.getExecutedQueries();
      expect(executed.length).toBe(3);

      // Verify workspace insert parameters
      expect(executed[1].operation).toBe("insert");
      expect(executed[1].insertValues).toEqual(
        expect.objectContaining({
          name: "Regional Mobility Hub",
          createdBy: "usr-creator-42",
        }),
      );

      // Verify membership insert parameters explicitly set 'owner'
      expect(executed[2].operation).toBe("insert");
      expect(executed[2].insertValues).toEqual(
        expect.objectContaining({
          workspaceId: "ws-new-prov-1",
          userId: "usr-creator-42",
          role: "owner",
        }),
      );
    });

    it("falls back to organization-based default name if provided name is empty or too short", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-creator-43" });
      const mockProfile = createMockAuthProfile({
        id: "usr-creator-43",
        organization: "Metropolitan Water District",
      });

      setServerAuthResult({
        status: "authenticated",
        user: mockUser,
        profile: mockProfile,
        isDemo: false,
      });

      db.queueResults(
        [], // existing check
        [
          {
            id: "ws-default-name-1",
            name: "Metropolitan Water District Workspace",
            createdBy: "usr-creator-43",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        [],
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "POST",
        body: { name: "  " }, // blank name
      });

      const res = await postWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.workspace.name).toBe("Metropolitan Water District Workspace");
    });
  });

  // =========================================================================
  // SECTION 4: Duplicate Submission & Existing Membership Handling
  // =========================================================================
  describe("Duplicate Submissions & Existing Workspace Handling", () => {
    it("returns existing workspace with 200 OK without creating duplicates", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-existing-member" });
      const mockProfile = createMockAuthProfile({ id: "usr-existing-member" });

      setServerAuthResult({
        status: "authenticated",
        user: mockUser,
        profile: mockProfile,
        isDemo: false,
      });

      // DB Queue: Existing membership found
      db.queueResult([
        {
          membershipId: "mem-existing-1",
          workspaceId: "ws-already-created",
          workspaceName: "Existing Infrastructure Workspace",
          role: "owner",
          joinedAt: new Date("2026-01-15T00:00:00Z"),
          workspaceCreatedAt: new Date("2026-01-15T00:00:00Z"),
        },
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "POST",
        body: { name: "Duplicate Request Attempt" },
      });

      const res = await postWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.alreadyExists).toBe(true);
      expect(json.workspace.id).toBe("ws-already-created");
      expect(json.workspace.name).toBe("Existing Infrastructure Workspace");

      // Verify that NO insert query was executed
      const executed = db.getExecutedQueries();
      expect(executed.length).toBe(1);
      expect(executed[0].operation).toBe("select");
    });

    it("direct createWorkspaceForUser returns alreadyExists: true when user already has membership", async () => {
      const user = createMockSupabaseUser({ id: "usr-direct-check" });

      db.queueResult([
        {
          membershipId: "mem-d-1",
          workspaceId: "ws-d-1",
          workspaceName: "Direct Existing Workspace",
          role: "editor",
          joinedAt: new Date("2026-02-01T00:00:00Z"),
          workspaceCreatedAt: new Date("2026-02-01T00:00:00Z"),
        },
      ]);

      const result = await createWorkspaceForUser(user, "New Workspace Attempt");

      expect(result.success).toBe(true);
      expect(result.alreadyExists).toBe(true);
      expect(result.workspace.id).toBe("ws-d-1");
      expect(result.workspace.role).toBe("editor");

      const executed = db.getExecutedQueries();
      expect(executed.length).toBe(1);
      expect(executed[0].operation).toBe("select");
    });
  });

  // =========================================================================
  // SECTION 5: Database Errors & Fail-Closed Upstream Protection
  // =========================================================================
  describe("Database Failure & Fail-Closed Protection", () => {
    it("POST /api/workspaces returns 500 without leaking connection strings on DB failure", async () => {
      const mockUser = createMockSupabaseUser({ id: "usr-db-fail" });
      const mockProfile = createMockAuthProfile({ id: "usr-db-fail" });

      setServerAuthResult({
        status: "authenticated",
        user: mockUser,
        profile: mockProfile,
        isDemo: false,
      });

      // Inject simulated database connection crash
      db.throwOnNext(new Error("FATAL: password authentication failed for user postgres at 10.0.0.1:5432"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces",
        method: "POST",
        body: { name: "Crash Test Workspace" },
      });

      const res = await postWorkspaces(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create workspace.");
      // Ensure no sensitive technical data or credentials leaked in response
      expect(JSON.stringify(json)).not.toContain("password");
      expect(JSON.stringify(json)).not.toContain("postgres");
      expect(JSON.stringify(json)).not.toContain("5432");
    });

    it("direct createWorkspaceForUser throws on invalid user parameter", async () => {
      // @ts-expect-error Testing invalid input fail-closed behavior
      await expect(createWorkspaceForUser(null)).rejects.toThrow(
        "Cannot create workspace without authenticated user",
      );
    });
  });
});
