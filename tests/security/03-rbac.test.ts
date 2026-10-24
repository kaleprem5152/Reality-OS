import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import {
  createMockDb,
  createMockProjectRow,
  createMockReportRow,
} from "../helpers/mock-db";
import type { ApiAuthResult } from "@/lib/api-auth";

// Hoisted state shared with vi.mock
const { getAuthResult, setAuthResult } = vi.hoisted(() => {
  let currentAuth: any = null;

  return {
    getAuthResult: () => currentAuth,
    setAuthResult: (r: any) => {
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

// 2. Mock authenticateApiRequest so route handlers can be tested under specific roles
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getAuthResult()),
  };
});

// Import route handlers under test
import { POST as postProjects } from "@/app/api/projects/route";
import {
  GET as getProjectById,
  PATCH as patchProjectById,
  DELETE as deleteProjectById,
} from "@/app/api/projects/[id]/route";
import { POST as postReports } from "@/app/api/reports/route";
import {
  GET as getReportById,
  DELETE as deleteReportById,
} from "@/app/api/reports/[id]/route";
import { db as rawDb } from "@/db";
import type { MockDb } from "../helpers/mock-db";

describe("03 - RBAC Security Test Suite", () => {
  const db = rawDb as unknown as MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Viewers cannot create, update, or delete projects or reports
  // --------------------------------------------------------------------------
  describe("1. Viewers cannot mutate projects or reports (read-only enforcement)", () => {
    beforeEach(() => {
      setAuthResult(createMockAuthenticatedContext("viewer"));
    });

    it("rejects project creation by viewers with 403 Forbidden without executing DB insert", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: { name: "Viewer Unauthorized Project", infraType: "Rail & Transit", region: "Central" },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions");

      // Verify no DB insert occurred
      const inserts = db.getExecutedQueries().filter((q) => q.operation === "insert");
      expect(inserts.length).toBe(0);
    });

    it("rejects project update by viewers with 403 Forbidden without executing DB update", async () => {
      // Return existing project lookup row so it reaches the role check
      db.queueResult([{ id: "PRJ-1001" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { name: "Viewer Attempted Update" },
      });

      const res = await patchProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions");

      // Verify no DB update occurred
      const updates = db.getExecutedQueries().filter((q) => q.operation === "update");
      expect(updates.length).toBe(0);
    });

    it("rejects project deletion by viewers with 403 Forbidden without executing DB delete", async () => {
      // Return existing project lookup row
      db.queueResult([{ id: "PRJ-1001", createdBy: "usr-mock-1" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions");

      // Verify no DB delete occurred
      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(0);
    });

    it("rejects report creation by viewers with 403 Forbidden without executing DB insert", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: "PRJ-1001",
          title: "Viewer Report",
          reportType: "Feasibility",
          content: { summary: "Test" },
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions");

      const inserts = db.getExecutedQueries().filter((q) => q.operation === "insert");
      expect(inserts.length).toBe(0);
    });

    it("rejects report deletion by viewers with 403 Forbidden without executing DB delete", async () => {
      // Return existing report lookup row
      db.queueResult([{ id: "RPT-5001", createdBy: "usr-mock-1" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "DELETE",
      });

      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions");

      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Editors can create projects and reports in their authorized workspace
  // --------------------------------------------------------------------------
  describe("2. Editors can create projects and reports in their authorized workspace", () => {
    const editorId = "usr-editor-alpha";
    const workspaceId = "ws-mock-alpha";

    beforeEach(() => {
      setAuthResult(createMockAuthenticatedContext("editor", { userId: editorId, workspaceId }));
    });

    it("permits editors to create projects and saves them scoped to workspace and author", async () => {
      // Query 1: Determine sequential project ID
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Insert project returning row
      db.queueResult([
        createMockProjectRow({
          id: "PRJ-1002",
          workspaceId,
          createdBy: editorId,
          name: "Editor High Speed Line",
        }),
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Editor High Speed Line",
          description: "Editor created corridor",
          infraType: "Rail & Transit",
          region: "Central",
          budgetCrore: 4000,
          targetCompletion: "2030",
        },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.id).toBe("PRJ-1002");
      expect(json.name).toBe("Editor High Speed Line");

      // Verify DB insert received editor credentials
      const insertQuery = db.getExecutedQueries().find((q) => q.operation === "insert");
      expect(insertQuery).toBeDefined();
      expect((insertQuery?.insertValues as any).workspaceId).toBe(workspaceId);
      expect((insertQuery?.insertValues as any).createdBy).toBe(editorId);
    });

    it("permits editors to create reports linked to projects in the authorized workspace", async () => {
      // Query 1: Verify parent project in workspace
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Existing reports for sequential ID
      db.queueResult([{ id: "RPT-5001" }]);
      // Query 3: Insert report returning row
      db.queueResult([
        createMockReportRow({
          id: "RPT-5002",
          workspaceId,
          projectId: "PRJ-1001",
          createdBy: editorId,
          title: "Editor Assessment Report",
        }),
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: "PRJ-1001",
          title: "Editor Assessment Report",
          reportType: "Feasibility",
          content: { findings: "Feasible" },
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.id).toBe("RPT-5002");
      expect(json.title).toBe("Editor Assessment Report");

      const insertQuery = db.getExecutedQueries().find((q) => q.operation === "insert");
      expect(insertQuery).toBeDefined();
      expect((insertQuery?.insertValues as any).workspaceId).toBe(workspaceId);
      expect((insertQuery?.insertValues as any).createdBy).toBe(editorId);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Editors cannot delete another user's project or report
  // --------------------------------------------------------------------------
  describe("3. Editors cannot delete another user's project or report", () => {
    const editorId = "usr-editor-1";
    const otherUserId = "usr-author-2";

    beforeEach(() => {
      setAuthResult(createMockAuthenticatedContext("editor", { userId: editorId }));
    });

    it("rejects editor attempt to delete another user's project with 403 Forbidden", async () => {
      // Project lookup returns record owned by otherUserId
      db.queueResult([{ id: "PRJ-1001", createdBy: otherUserId }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions to delete this project");

      // Verify no DB delete was executed
      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(0);
    });

    it("rejects editor attempt to delete another user's report with 403 Forbidden", async () => {
      // Report lookup returns record owned by otherUserId
      db.queueResult([{ id: "RPT-5001", createdBy: otherUserId }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "DELETE",
      });

      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Insufficient permissions to delete this report");

      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Editors can delete their own records
  // --------------------------------------------------------------------------
  describe("4. Editors can delete their own records within their workspace", () => {
    const editorId = "usr-editor-self";

    beforeEach(() => {
      setAuthResult(createMockAuthenticatedContext("editor", { userId: editorId }));
    });

    it("allows editor to delete their own project", async () => {
      // Query 1: Project lookup confirms editor is the creator
      db.queueResult([{ id: "PRJ-1001", createdBy: editorId }]);
      // Query 2: Cascade report deletion
      db.queueResult([]);
      // Query 3: Project deletion returning
      db.queueResult([{ id: "PRJ-1001" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toEqual({ ok: true });

      // Verify delete queries executed
      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(2); // reports cascade + project
    });

    it("allows editor to delete their own report", async () => {
      // Query 1: Report lookup confirms editor is the creator
      db.queueResult([{ id: "RPT-5001", createdBy: editorId }]);
      // Query 2: Report deletion returning
      db.queueResult([{ id: "RPT-5001" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "DELETE",
      });

      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toEqual({ ok: true });

      const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
      expect(deletes.length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Admins and owners can manage records within their workspace
  // --------------------------------------------------------------------------
  describe("5. Admins and owners can manage any record within their workspace", () => {
    const adminId = "usr-admin-1";
    const otherUserId = "usr-subordinate-2";

    it("allows admins to delete a project created by another user in their workspace", async () => {
      setAuthResult(createMockAuthenticatedContext("admin", { userId: adminId }));

      db.queueResult([{ id: "PRJ-1001", createdBy: otherUserId }]);
      db.queueResult([]); // cascade reports
      db.queueResult([{ id: "PRJ-1001" }]); // delete project

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("allows owners to delete a report created by another user in their workspace", async () => {
      setAuthResult(createMockAuthenticatedContext("owner", { userId: "usr-owner-1" }));

      db.queueResult([{ id: "RPT-5001", createdBy: otherUserId }]);
      db.queueResult([{ id: "RPT-5001" }]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "DELETE",
      });

      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("allows admins to update projects created by another user", async () => {
      setAuthResult(createMockAuthenticatedContext("admin", { userId: adminId }));

      // Query 1: Existing project lookup
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Update returning row
      db.queueResult([
        createMockProjectRow({
          id: "PRJ-1001",
          name: "Admin Renamed Corridor",
          status: "Planning",
        }),
      ]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { name: "Admin Renamed Corridor" },
      });

      const res = await patchProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("Admin Renamed Corridor");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 6: No role can access or mutate another workspace's records
  // --------------------------------------------------------------------------
  describe("6. Cross-workspace access and mutation is completely denied for all roles", () => {
    it.each(["owner", "admin", "editor", "viewer"] as const)(
      "%s role cannot view a project belonging to another workspace (returns 404)",
      async (role) => {
        setAuthResult(createMockAuthenticatedContext(role, { workspaceId: "ws-mock-alpha" }));
        // DB lookup returns empty array because query filters by workspaceId = ws-mock-alpha
        db.queueResult([]);

        const req = createMockNextRequest({
          url: "http://localhost:3000/api/projects/PRJ-FOREIGN",
          method: "GET",
        });

        const res = await getProjectById(req, { params: Promise.resolve({ id: "PRJ-FOREIGN" }) });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain("Project not found");
      },
    );

    it.each(["owner", "admin", "editor"] as const)(
      "%s role cannot update a project belonging to another workspace (returns 404)",
      async (role) => {
        setAuthResult(createMockAuthenticatedContext(role, { workspaceId: "ws-mock-alpha" }));
        db.queueResult([]); // Project not found in caller's workspace

        const req = createMockNextRequest({
          url: "http://localhost:3000/api/projects/PRJ-FOREIGN",
          method: "PATCH",
          body: { name: "Attacker Attempted Update" },
        });

        const res = await patchProjectById(req, { params: Promise.resolve({ id: "PRJ-FOREIGN" }) });
        expect(res.status).toBe(404);

        // Verify update was never called
        const updates = db.getExecutedQueries().filter((q) => q.operation === "update");
        expect(updates.length).toBe(0);
      },
    );

    it.each(["owner", "admin", "editor"] as const)(
      "%s role cannot delete a project belonging to another workspace (returns 404)",
      async (role) => {
        setAuthResult(createMockAuthenticatedContext(role, { workspaceId: "ws-mock-alpha" }));
        db.queueResult([]); // Project not found in caller's workspace

        const req = createMockNextRequest({
          url: "http://localhost:3000/api/projects/PRJ-FOREIGN",
          method: "DELETE",
        });

        const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-FOREIGN" }) });
        expect(res.status).toBe(404);

        const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
        expect(deletes.length).toBe(0);
      },
    );

    it.each(["owner", "admin", "editor", "viewer"] as const)(
      "%s role cannot view a report belonging to another workspace (returns 404)",
      async (role) => {
        setAuthResult(createMockAuthenticatedContext(role, { workspaceId: "ws-mock-alpha" }));
        db.queueResult([]);

        const req = createMockNextRequest({
          url: "http://localhost:3000/api/reports/RPT-FOREIGN",
          method: "GET",
        });

        const res = await getReportById(req, { params: Promise.resolve({ id: "RPT-FOREIGN" }) });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toContain("Report not found");
      },
    );

    it.each(["owner", "admin", "editor"] as const)(
      "%s role cannot delete a report belonging to another workspace (returns 404)",
      async (role) => {
        setAuthResult(createMockAuthenticatedContext(role, { workspaceId: "ws-mock-alpha" }));
        db.queueResult([]);

        const req = createMockNextRequest({
          url: "http://localhost:3000/api/reports/RPT-FOREIGN",
          method: "DELETE",
        });

        const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-FOREIGN" }) });
        expect(res.status).toBe(404);

        const deletes = db.getExecutedQueries().filter((q) => q.operation === "delete");
        expect(deletes.length).toBe(0);
      },
    );
  });
});
