import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockSupabaseUser,
  createMockAuthProfile,
  createMockDemoContext,
  createMockUnauthenticatedContext,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import { createMockDb, createMockProjectRow, type MockDb } from "../helpers/mock-db";
import { memoryStore } from "@/lib/memory-store";

// Hoisted state shared with vi.mock
const { getApiAuthResult, setApiAuthResult } = vi.hoisted(() => {
  let currentApiAuth: any = null;

  return {
    getApiAuthResult: () => currentApiAuth,
    setApiAuthResult: (r: any) => {
      currentApiAuth = r;
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

// 2. Mock authenticateApiRequest
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getApiAuthResult()),
  };
});

// Import route handlers under test
import { GET as getProjects, POST as postProjects } from "@/app/api/projects/route";
import {
  GET as getProjectById,
  PATCH as patchProjectById,
  DELETE as deleteProjectById,
} from "@/app/api/projects/[id]/route";
import { db as rawDb } from "@/db";

describe("08 - Projects & Corridors Security, Persistence, and Editing Test Suite", () => {
  const db = rawDb as unknown as MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
  });

  // =========================================================================
  // SECTION 1: Project Creation & Corridor Persistence
  // =========================================================================
  describe("Project Creation & Corridor Alignment Persistence", () => {
    it("POST /api/projects persists a new project with corridorKm and stations in caller's workspace", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        userId: "usr-editor-7",
        workspaceId: "ws-transit-alpha",
      });
      setApiAuthResult(auth);

      // Mock DB:
      // 1. db.select({ id: projects.id }).from(projects) -> existing project IDs for maxNum check
      // 2. db.insert(projects).values(...).returning() -> returned inserted row
      db.queueResults(
        [{ id: "PRJ-1002" }], // existing projects for sequential ID PRJ-1003
        [
          createMockProjectRow({
            id: "PRJ-1003",
            workspaceId: "ws-transit-alpha",
            createdBy: "usr-editor-7",
            name: "Western Coastal Rail Corridor",
            description: "High-capacity transit corridor with 18 stations.",
            infraType: "Rail & Transit",
            region: "Coastal Metro",
            status: "Planning",
            budgetCrore: 14500,
            targetCompletion: "2031",
            riskLevel: "Moderate",
            capacityTarget: "300,000 daily passengers",
            corridorKm: 58.4,
            stations: 18,
            archived: false,
            featured: false,
          }),
        ],
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Western Coastal Rail Corridor",
          description: "High-capacity transit corridor with 18 stations.",
          infraType: "Rail & Transit",
          region: "Coastal Metro",
          budgetCrore: 14500,
          targetCompletion: "2031",
          capacityTarget: "300,000 daily passengers",
          corridorKm: 58.4,
          stations: 18,
        },
      });

      const res = await postProjects(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.id).toBe("PRJ-1003");
      expect(json.name).toBe("Western Coastal Rail Corridor");
      expect(json.corridorKm).toBe(58.4);
      expect(json.stations).toBe(18);
      expect(json.budgetCrore).toBe(14500);

      const queries = db.getExecutedQueries();
      expect(queries.length).toBe(2);
      expect(queries[1].operation).toBe("insert");
      expect(queries[1].insertValues).toEqual(
        expect.objectContaining({
          id: "PRJ-1003",
          workspaceId: "ws-transit-alpha",
          createdBy: "usr-editor-7",
          name: "Western Coastal Rail Corridor",
          corridorKm: 58.4,
          stations: 18,
        }),
      );
    });

    it("POST /api/projects enforces input validation (rejects invalid budget and short name)", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);

      // Short name test
      const reqShortName = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "No",
          infraType: "Rail & Transit",
          region: "Metro",
          budgetCrore: 500,
          targetCompletion: "2030",
        },
      });
      const resShort = await postProjects(reqShortName);
      expect(resShort.status).toBe(400);
      const jsonShort = await resShort.json();
      expect(jsonShort.error).toContain("min 3 characters");

      // Non-positive budget test
      const reqBadBudget = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Valid Project Name",
          infraType: "Rail & Transit",
          region: "Metro",
          budgetCrore: -50,
          targetCompletion: "2030",
        },
      });
      const resBudget = await postProjects(reqBadBudget);
      expect(resBudget.status).toBe(400);
      const jsonBudget = await resBudget.json();
      expect(jsonBudget.error).toContain("positive number");
    });
  });

  // =========================================================================
  // SECTION 2: Editing, Budget, Status, and Archive/Restore
  // =========================================================================
  describe("Project Editing, Status, Budget, and Archive/Restore", () => {
    it("PATCH /api/projects/[id] updates status, budget, corridorKm, and capacity target", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-transit-alpha",
      });
      setApiAuthResult(auth);

      // Mock DB:
      // 1. Select existing project in workspace -> found
      // 2. Update returning -> updated row
      db.queueResults(
        [{ id: "PRJ-1001" }], // found existing
        [
          createMockProjectRow({
            id: "PRJ-1001",
            workspaceId: "ws-transit-alpha",
            name: "Metro Intelligence Phase 1",
            status: "In Review",
            budgetCrore: 19800,
            corridorKm: 72.5,
            stations: 26,
            capacityTarget: "500,000 daily trips",
          }),
        ],
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: {
          status: "In Review",
          budgetCrore: 19800,
          corridorKm: 72.5,
          stations: 26,
          capacityTarget: "500,000 daily trips",
        },
      });

      const res = await patchProjectById(req, {
        params: Promise.resolve({ id: "PRJ-1001" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("In Review");
      expect(json.budgetCrore).toBe(19800);
      expect(json.corridorKm).toBe(72.5);
      expect(json.stations).toBe(26);

      const queries = db.getExecutedQueries();
      expect(queries.length).toBe(2);
      expect(queries[1].operation).toBe("update");
      expect(queries[1].updateSet).toEqual(
        expect.objectContaining({
          status: "In Review",
          budgetCrore: 19800,
          corridorKm: 72.5,
          stations: 26,
        }),
      );
    });

    it("PATCH /api/projects/[id] archives project and updates status to Archived", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-transit-alpha",
      });
      setApiAuthResult(auth);

      db.queueResults(
        [{ id: "PRJ-1001" }],
        [
          createMockProjectRow({
            id: "PRJ-1001",
            workspaceId: "ws-transit-alpha",
            archived: true,
            status: "Archived",
          }),
        ],
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { archived: true },
      });

      const res = await patchProjectById(req, {
        params: Promise.resolve({ id: "PRJ-1001" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.archived).toBe(true);
      expect(json.status).toBe("Archived");

      const queries = db.getExecutedQueries();
      expect(queries[1].updateSet).toEqual(
        expect.objectContaining({
          archived: true,
          status: "Archived",
        }),
      );
    });

    it("PATCH /api/projects/[id] restores project and restores status to Planning if not specified", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-transit-alpha",
      });
      setApiAuthResult(auth);

      db.queueResults(
        [{ id: "PRJ-1001" }],
        [
          createMockProjectRow({
            id: "PRJ-1001",
            workspaceId: "ws-transit-alpha",
            archived: false,
            status: "Planning",
          }),
        ],
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { archived: false },
      });

      const res = await patchProjectById(req, {
        params: Promise.resolve({ id: "PRJ-1001" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.archived).toBe(false);
      expect(json.status).toBe("Planning");

      const queries = db.getExecutedQueries();
      expect(queries[1].updateSet).toEqual(
        expect.objectContaining({
          archived: false,
          status: "Planning",
        }),
      );
    });
  });

  // =========================================================================
  // SECTION 3: Workspace Isolation & Foreign Resource Protection
  // =========================================================================
  describe("Workspace Isolation & Unauthorized Rejection", () => {
    it("GET /api/projects/[id] returns 404 for project belonging to a foreign workspace", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-isolated-tenant-a",
      });
      setApiAuthResult(auth);

      // Foreign project lookup returns empty row in caller's workspace
      db.queueResult([]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-FOREIGN-999",
        method: "GET",
      });

      const res = await getProjectById(req, {
        params: Promise.resolve({ id: "PRJ-FOREIGN-999" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");
    });

    it("PATCH /api/projects/[id] returns 404 when attempting to mutate foreign workspace project", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-isolated-tenant-a",
      });
      setApiAuthResult(auth);

      // Existing check returns empty array
      db.queueResult([]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-FOREIGN-999",
        method: "PATCH",
        body: { budgetCrore: 99999 },
      });

      const res = await patchProjectById(req, {
        params: Promise.resolve({ id: "PRJ-FOREIGN-999" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");

      // Verify NO update query was executed
      const queries = db.getExecutedQueries();
      expect(queries.length).toBe(1);
      expect(queries[0].operation).toBe("select");
    });

    it("DELETE /api/projects/[id] returns 404 when attempting to delete foreign workspace project", async () => {
      const auth = createMockAuthenticatedContext("owner", {
        workspaceId: "ws-isolated-tenant-a",
      });
      setApiAuthResult(auth);

      // Existing check returns empty array
      db.queueResult([]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-FOREIGN-999",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, {
        params: Promise.resolve({ id: "PRJ-FOREIGN-999" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");

      // Verify NO delete query was executed
      const queries = db.getExecutedQueries();
      expect(queries.length).toBe(1);
      expect(queries[0].operation).toBe("select");
    });
  });

  // =========================================================================
  // SECTION 4: Fail-Closed Protection Without Silent Memory Fallback
  // =========================================================================
  describe("Fail-Closed Protection on Database Failure", () => {
    it("POST /api/projects fails closed with 500 when database throws and never writes to memory store", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-prod-fail",
      });
      setApiAuthResult(auth);

      const countBefore = memoryStore.getProjects().length;
      db.throwOnNext(new Error("FATAL: connection terminated unexpectedly"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Resilient Bridge Project",
          infraType: "Bridges & Tunnels",
          region: "Harbor District",
          budgetCrore: 3200,
          targetCompletion: "2029",
        },
      });

      const res = await postProjects(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create project.");

      // Ensure no silent fallback to memoryStore occurred
      const countAfter = memoryStore.getProjects().length;
      expect(countAfter).toBe(countBefore);
      expect(memoryStore.getProjects().some((p) => p.name === "Resilient Bridge Project")).toBe(false);
    });

    it("PATCH /api/projects/[id] fails closed with 500 when database update throws", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-prod-fail",
      });
      setApiAuthResult(auth);

      db.queueResult([{ id: "PRJ-1001" }]);
      db.throwOnNext(new Error("Database write lock error"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { budgetCrore: 4000 },
      });

      const res = await patchProjectById(req, {
        params: Promise.resolve({ id: "PRJ-1001" }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to update project.");
    });
  });
});
