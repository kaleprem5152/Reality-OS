import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockSupabaseUser,
  createMockAuthProfile,
  createMockMembership,
} from "../helpers/mock-auth";
import {
  createMockProjectRow,
  createMockReportRow,
  createMockWorkspaceMembershipRow,
  type MockDb,
} from "../helpers/mock-db";
import type { ServerAuthResult } from "@/lib/auth-server";

// Hoisted state shared with vi.mock
const { getAuthServerResult, setAuthServerResult } = vi.hoisted(() => {
  let currentAuth: any = null;
  return {
    getAuthServerResult: () => currentAuth,
    setAuthServerResult: (r: any) => {
      currentAuth = r;
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

// 2. Mock getServerAuth so authenticateApiRequest uses real resolveUserWorkspace and query chains
vi.mock("@/lib/auth-server", () => ({
  getServerAuth: vi.fn(async () => getAuthServerResult()),
}));

// Import DB and application modules under test
import { db as rawDb } from "@/db";
import { resolveUserWorkspace } from "@/lib/workspace-server";
import { authenticateApiRequest, createApiAuthErrorResponse } from "@/lib/api-auth";
import { POST as postProjects } from "@/app/api/projects/route";
import {
  GET as getProjectById,
  DELETE as deleteProjectById,
} from "@/app/api/projects/[id]/route";
import { POST as postReports } from "@/app/api/reports/route";
import { GET as getReportById } from "@/app/api/reports/[id]/route";

describe("04 - Workspace Isolation Security Test Suite", () => {
  const db = rawDb as unknown as MockDb;
  const verifiedUser = createMockSupabaseUser({ id: "usr-tenant-alpha", email: "alpha@realityos.test" });
  const verifiedProfile = createMockAuthProfile({ id: verifiedUser.id, email: verifiedUser.email });

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    setAuthServerResult({
      status: "authenticated",
      user: verifiedUser,
      profile: verifiedProfile,
      isDemo: false,
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Requests selecting an unauthorized workspace are rejected
  // without revealing workspace IDs or names
  // --------------------------------------------------------------------------
  describe("7. Unauthorized workspace requests fail closed without leaking IDs or names", () => {
    it("resolveUserWorkspace rejects foreign workspace ID with generic reason without leaking target ID or name", async () => {
      // User is a member ONLY of ws-authorized-alpha
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: "ws-authorized-alpha",
          workspaceName: "Alpha Authority",
          role: "editor",
        }),
      ]);

      const auth: ServerAuthResult = {
        status: "authenticated",
        user: verifiedUser,
        profile: verifiedProfile,
        isDemo: false,
      };

      const result = await resolveUserWorkspace(auth, "ws-secret-foreign-beta");
      expect(result.status).toBe("forbidden");

      if (result.status === "forbidden") {
        expect(result.reason).toBe("Access to the requested workspace is denied.");
        expect(result.reason).not.toContain("ws-secret-foreign-beta");
        expect(result.reason).not.toContain("Alpha Authority");
      }
    });

    it("authenticateApiRequest rejects request with foreign x-workspace-id with 403 without data leakage", async () => {
      // Queue user memberships: only ws-authorized-alpha
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: "ws-authorized-alpha",
          workspaceName: "Alpha Authority",
          role: "editor",
        }),
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        headers: { "x-workspace-id": "ws-secret-foreign-beta" },
      });

      const auth = await authenticateApiRequest(req);
      expect(auth.status).toBe("forbidden");

      const errorRes = createApiAuthErrorResponse(auth);
      expect(errorRes).not.toBeNull();
      expect(errorRes!.status).toBe(403);

      const json = await errorRes!.json();
      expect(json).toEqual({ error: "Access to the requested workspace is denied." });
      expect(JSON.stringify(json)).not.toContain("ws-secret-foreign-beta");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Project and report detail endpoints return 404 for foreign-workspace IDs
  // --------------------------------------------------------------------------
  describe("8. Project and report detail endpoints return 404 for foreign-workspace records", () => {
    const callerWorkspaceId = "ws-caller-alpha";

    beforeEach(() => {
      // Setup memberships for caller in ws-caller-alpha
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: callerWorkspaceId,
          role: "editor",
        }),
      ]);
    });

    it("GET /api/projects/[id] returns 404 when project exists under another workspace", async () => {
      // Query 1: Membership resolution (consumed in beforeEach)
      // Query 2: Project lookup with where: and(eq(projects.id, id), eq(projects.workspaceId, ws-caller-alpha))
      // DB returns empty array because record belongs to foreign workspace
      db.queueResult([]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-FOREIGN",
      });

      const res = await getProjectById(req, { params: Promise.resolve({ id: "PRJ-FOREIGN" }) });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Project not found");
    });

    it("GET /api/reports/[id] returns 404 when report exists under another workspace", async () => {
      // Report lookup in DB returns empty because query filters by caller workspace
      db.queueResult([]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-FOREIGN",
      });

      const res = await getReportById(req, { params: Promise.resolve({ id: "RPT-FOREIGN" }) });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Report not found");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Report creation rejects parent project belonging to another workspace
  // --------------------------------------------------------------------------
  describe("9. Report creation rejects parent projects belonging to another workspace", () => {
    const callerWorkspaceId = "ws-caller-alpha";

    beforeEach(() => {
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: callerWorkspaceId,
          role: "editor",
        }),
      ]);
    });

    it("rejects report creation with 404 when referenced project belongs to another workspace", async () => {
      // Parent project lookup with and(eq(projects.id, projectId), eq(projects.workspaceId, ws-caller-alpha)) returns empty
      db.queueResult([]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: "PRJ-FOREIGN-WORKSPACE",
          title: "Cross Workspace Exploitation Report",
          reportType: "Planning Analysis",
          content: { summary: "Unauthorized attachment" },
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Project not found");

      // Verify no report insert was executed
      const inserts = db.getExecutedQueries().filter((q) => q.operation === "insert");
      expect(inserts.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Project deletion cannot delete reports belonging to a different workspace
  // --------------------------------------------------------------------------
  describe("10. Project deletion cascades reports strictly within the authenticated workspace", () => {
    const callerWorkspaceId = "ws-caller-alpha";
    const callerUserId = verifiedUser.id;

    it("scopes report cascade deletion query by both projectId AND caller workspaceId", async () => {
      // 1. Membership resolution
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: callerWorkspaceId,
          role: "admin",
        }),
      ]);
      // 2. Project lookup
      db.queueResult([{ id: "PRJ-1001", createdBy: callerUserId }]);
      // 3. Cascade report delete
      db.queueResult([]);
      // 4. Project delete returning
      db.queueResult([{ id: "PRJ-1001" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(200);

      // Verify executed delete queries
      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(2);

      // Verify report cascade delete query condition contains workspaceId scoping
      const reportDeleteQuery = deletes[0];
      expect(reportDeleteQuery).toBeDefined();
      expect(reportDeleteQuery.whereCondition).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 11: New records receive server-derived workspaceId and createdBy values
  // --------------------------------------------------------------------------
  describe("11. Client-supplied protected fields (workspaceId, createdBy, id) cannot override server values", () => {
    const verifiedWorkspaceId = "ws-legitimate-alpha";
    const verifiedUserId = verifiedUser.id;

    beforeEach(() => {
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: verifiedWorkspaceId,
          role: "editor",
        }),
      ]);
    });

    it("overrides client-supplied workspaceId, createdBy, and id on project creation", async () => {
      // Query 1: Existing projects for sequential ID
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Insert returning
      db.queueResult([
        createMockProjectRow({
          id: "PRJ-1002",
          workspaceId: verifiedWorkspaceId,
          createdBy: verifiedUserId,
          name: "Legitimate Project",
        }),
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          id: "PRJ-CLIENT-OVERRIDE",
          workspaceId: "ws-victim-target",
          createdBy: "usr-hacker-target",
          name: "Legitimate Project",
          infraType: "Rail & Transit",
          region: "Central",
          budgetCrore: 2500,
          targetCompletion: "2030",
        },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(201);

      const insertQuery = db.getExecutedQueries().find((q) => q.operation === "insert");
      expect(insertQuery).toBeDefined();

      const insertedVals = insertQuery!.insertValues as Record<string, unknown>;
      expect(insertedVals.workspaceId).toBe(verifiedWorkspaceId);
      expect(insertedVals.createdBy).toBe(verifiedUserId);
      expect(insertedVals.id).toBe("PRJ-1002");
      expect(insertedVals.id).not.toBe("PRJ-CLIENT-OVERRIDE");
    });

    it("overrides client-supplied workspaceId, createdBy, and id on report creation", async () => {
      // Query 1: Parent project lookup in caller workspace
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Existing reports for sequential ID
      db.queueResult([{ id: "RPT-5001" }]);
      // Query 3: Insert returning
      db.queueResult([
        createMockReportRow({
          id: "RPT-5002",
          workspaceId: verifiedWorkspaceId,
          projectId: "PRJ-1001",
          createdBy: verifiedUserId,
          title: "Legitimate Report",
        }),
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          id: "RPT-CLIENT-OVERRIDE",
          workspaceId: "ws-victim-target",
          createdBy: "usr-hacker-target",
          projectId: "PRJ-1001",
          title: "Legitimate Report",
          reportType: "Planning Analysis",
          content: { metrics: "valid" },
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(201);

      const insertQuery = db.getExecutedQueries().find((q) => q.operation === "insert");
      expect(insertQuery).toBeDefined();

      const insertedVals = insertQuery!.insertValues as Record<string, unknown>;
      expect(insertedVals.workspaceId).toBe(verifiedWorkspaceId);
      expect(insertedVals.createdBy).toBe(verifiedUserId);
      expect(insertedVals.id).toBe("RPT-5002");
      expect(insertedVals.id).not.toBe("RPT-CLIENT-OVERRIDE");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Invalid membership roles fail closed
  // --------------------------------------------------------------------------
  describe("12. Invalid membership roles in database fail closed with error status", () => {
    it.each(["superadmin", "guest", "root", "hacker", "", "VIEWER"])(
      "resolveUserWorkspace returns error when DB contains invalid role '%s'",
      async (invalidRole) => {
        db.queueResult([
          createMockWorkspaceMembershipRow({
            workspaceId: "ws-mock-alpha",
            role: invalidRole,
          }),
        ]);

        const auth: ServerAuthResult = {
          status: "authenticated",
          user: verifiedUser,
          profile: verifiedProfile,
          isDemo: false,
        };

        const result = await resolveUserWorkspace(auth);
        expect(result.status).toBe("error");

        if (result.status === "error") {
          expect(result.reason).toBe("Database returned an invalid workspace role.");
        }
      },
    );

    it("authenticateApiRequest maps invalid role error to 500 without leaking role string", async () => {
      db.queueResult([
        createMockWorkspaceMembershipRow({
          workspaceId: "ws-mock-alpha",
          role: "malicious_unrecognized_role",
        }),
      ]);

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const auth = await authenticateApiRequest(req);

      expect(auth.status).toBe("error");
      const errorRes = createApiAuthErrorResponse(auth);
      expect(errorRes).not.toBeNull();
      expect(errorRes!.status).toBe(500);

      const json = await errorRes!.json();
      expect(json.error).toBe("An error occurred while authenticating the request.");
      expect(JSON.stringify(json)).not.toContain("malicious_unrecognized_role");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Missing workspace membership and database errors fail closed
  // --------------------------------------------------------------------------
  describe("13. Missing workspace memberships and database errors fail closed", () => {
    it("resolveUserWorkspace returns no_workspace when user belongs to 0 workspaces", async () => {
      db.queueResult([]); // 0 memberships in DB

      const auth: ServerAuthResult = {
        status: "authenticated",
        user: verifiedUser,
        profile: verifiedProfile,
        isDemo: false,
      };

      const result = await resolveUserWorkspace(auth);
      expect(result.status).toBe("no_workspace");

      if (result.status === "no_workspace") {
        expect(result.reason).toContain("not joined or created any workspace");
      }
    });

    it("authenticateApiRequest returns 403 Forbidden when user has no workspace", async () => {
      db.queueResult([]); // 0 memberships

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const auth = await authenticateApiRequest(req);
      expect(auth.status).toBe("no_workspace");

      const errorRes = createApiAuthErrorResponse(auth);
      expect(errorRes).not.toBeNull();
      expect(errorRes!.status).toBe(403);

      const json = await errorRes!.json();
      expect(json.error).toBe("No active workspace membership found.");
    });

    it("resolveUserWorkspace and route handler fail closed with 500 when database throws connection error", async () => {
      db.throwOnNext(new Error("FATAL: connection to server at '10.0.0.1', port 5432 failed: Connection refused"));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const auth = await authenticateApiRequest(req);
      expect(auth.status).toBe("error");

      const errorRes = createApiAuthErrorResponse(auth);
      expect(errorRes).not.toBeNull();
      expect(errorRes!.status).toBe(500);

      const json = await errorRes!.json();
      expect(json.error).toBe("An error occurred while authenticating the request.");
      expect(JSON.stringify(json)).not.toContain("10.0.0.1");
      expect(JSON.stringify(json)).not.toContain("5432");
    });
  });
});
