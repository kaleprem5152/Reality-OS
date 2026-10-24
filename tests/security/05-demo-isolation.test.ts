import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockDemoContext,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import { createMockProjectRow, type MockDb } from "../helpers/mock-db";
import { memoryStore } from "@/lib/memory-store";
import { getServerAuth } from "@/lib/auth-server";

// Hoisted state shared with vi.mock
const { getAuthResult, setAuthResult, mockCookiesStore } = vi.hoisted(() => {
  let currentAuth: any = null;
  const cookies = new Map<string, string>();
  return {
    getAuthResult: () => currentAuth,
    setAuthResult: (r: any) => {
      currentAuth = r;
    },
    mockCookiesStore: cookies,
  };
});

// 1. Mock DB to track all database interactions and prevent real PostgreSQL calls
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// 2. Mock next/headers for getServerAuth cookie inspection
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = mockCookiesStore.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    getAll: () => Array.from(mockCookiesStore.entries()).map(([name, value]) => ({ name, value })),
  })),
}));

// 3. Mock authenticateApiRequest to toggle between demo and authenticated contexts
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getAuthResult()),
  };
});

// Import DB and route handlers
import { db as rawDb } from "@/db";
import { GET as getProjects, POST as postProjects } from "@/app/api/projects/route";
import {
  GET as getProjectById,
  PATCH as patchProjectById,
  DELETE as deleteProjectById,
} from "@/app/api/projects/[id]/route";
import { GET as getReports, POST as postReports } from "@/app/api/reports/route";
import {
  GET as getReportById,
  DELETE as deleteReportById,
} from "@/app/api/reports/[id]/route";
import { POST as postAiAnalyze } from "@/app/api/ai/analyze/route";

describe("05 - Demo Isolation and Sandbox Security Test Suite", () => {
  const db = rawDb as unknown as MockDb;
  const originalEnv = process.env;

  const globalForMemory = globalThis as typeof globalThis & {
    __realityos_memory_projects?: unknown[];
    __realityos_memory_reports?: unknown[];
  };

  let memoryProjectsSnapshot: unknown[] = [];
  let memoryReportsSnapshot: unknown[] = [];

  beforeEach(() => {
    // Snapshot in-memory store to prevent test state leakage
    if (globalForMemory.__realityos_memory_projects) {
      memoryProjectsSnapshot = JSON.parse(JSON.stringify(globalForMemory.__realityos_memory_projects));
    }
    if (globalForMemory.__realityos_memory_reports) {
      memoryReportsSnapshot = JSON.parse(JSON.stringify(globalForMemory.__realityos_memory_reports));
    }

    vi.clearAllMocks();
    db.reset();
    mockCookiesStore.clear();
    process.env = { ...originalEnv };
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.GEMINI_API_KEY;
    setAuthResult(createMockDemoContext());
  });

  afterEach(() => {
    // Restore in-memory store state
    if (memoryProjectsSnapshot.length > 0) {
      globalForMemory.__realityos_memory_projects = JSON.parse(JSON.stringify(memoryProjectsSnapshot));
    }
    if (memoryReportsSnapshot.length > 0) {
      globalForMemory.__realityos_memory_reports = JSON.parse(JSON.stringify(memoryReportsSnapshot));
    }

    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Demo-mode operations use the memory store and never query the database
  // --------------------------------------------------------------------------
  describe("1. Demo-mode project and report operations strictly use memoryStore (zero DB calls)", () => {
    it("GET /api/projects in demo mode reads exclusively from memory store with zero DB queries", async () => {
      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const res = await getProjects(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThan(0);

      // Verify zero DB queries executed
      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("POST /api/projects in demo mode creates in memory store with zero DB queries", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Demo Sandbox Corridor",
          description: "Isolated memory store project",
          infraType: "Rail & Transit",
          region: "Capital Region",
          budgetCrore: 2800,
          targetCompletion: "2031",
        },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe("Demo Sandbox Corridor");

      // Verify created in memoryStore
      const inMemory = memoryStore.getProject(json.id);
      expect(inMemory).not.toBeNull();
      expect(inMemory?.name).toBe("Demo Sandbox Corridor");

      // Zero DB calls
      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("GET /api/projects/[id] in demo mode reads from memory store with zero DB queries", async () => {
      const demoProject = memoryStore.getProjects()[0];
      const req = createMockNextRequest({ url: `http://localhost:3000/api/projects/${demoProject.id}` });
      const res = await getProjectById(req, { params: Promise.resolve({ id: demoProject.id }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(demoProject.id);

      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("PATCH /api/projects/[id] in demo mode updates memory store with zero DB queries", async () => {
      const demoProject = memoryStore.getProjects()[0];
      const req = createMockNextRequest({
        url: `http://localhost:3000/api/projects/${demoProject.id}`,
        method: "PATCH",
        body: { name: "Updated Demo Name" },
      });

      const res = await patchProjectById(req, { params: Promise.resolve({ id: demoProject.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("Updated Demo Name");

      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("DELETE /api/projects/[id] in demo mode deletes from memory store with zero DB queries", async () => {
      const created = memoryStore.createProject({
        name: "Temporary Demo Project",
        infraType: "Rail & Transit",
        region: "Capital Region",
        budgetCrore: 1000,
        targetCompletion: "2030",
      });

      const req = createMockNextRequest({
        url: `http://localhost:3000/api/projects/${created.id}`,
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: created.id }) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      expect(memoryStore.getProject(created.id)).toBeNull();
      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("GET /api/reports and POST /api/reports in demo mode interact only with memory store", async () => {
      const demoProject = memoryStore.getProjects()[0];

      // POST report in demo mode
      const postReq = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: demoProject.id,
          title: "Demo In-Memory Report",
          reportType: "Planning Analysis",
          content: { summary: "Offline simulation output" },
        },
      });

      const postRes = await postReports(postReq);
      expect(postRes.status).toBe(201);
      const createdReport = await postRes.json();
      expect(createdReport.title).toBe("Demo In-Memory Report");

      // GET reports in demo mode
      const getReq = createMockNextRequest({ url: "http://localhost:3000/api/reports" });
      const getRes = await getReports(getReq);
      expect(getRes.status).toBe(200);
      const reports = await getRes.json();
      expect(reports.some((r: { id: string }) => r.id === createdReport.id)).toBe(true);

      // GET single report
      const singleReq = createMockNextRequest({ url: `http://localhost:3000/api/reports/${createdReport.id}` });
      const singleRes = await getReportById(singleReq, { params: Promise.resolve({ id: createdReport.id }) });
      expect(singleRes.status).toBe(200);

      // DELETE report
      const delReq = createMockNextRequest({
        url: `http://localhost:3000/api/reports/${createdReport.id}`,
        method: "DELETE",
      });
      const delRes = await deleteReportById(delReq, { params: Promise.resolve({ id: createdReport.id }) });
      expect(delRes.status).toBe(200);
      expect(await delRes.json()).toEqual({ ok: true });

      // Zero DB operations throughout entire reports lifecycle
      expect(db.getExecutedQueries().length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Demo analysis never calls external Gemini endpoints
  // --------------------------------------------------------------------------
  describe("2. Demo analysis never calls external Gemini endpoints", () => {
    it("runs local deterministic simulation and never contacts Google Gemini API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          projectName: "Harbor Transit Extension",
          infraType: "Port & Logistics",
          region: "Coastal Zone",
          budgetCrore: 5200,
          requirements: "Expand automated freight connectivity along coastal freight spine.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.analysis).toBeDefined();
      expect(json.analysis.mode).toBe("demo");
      expect(json.analysis.agents.length).toBe(5);

      // Verify no network call made
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Demo requests cannot access real authenticated users' workspace records
  // --------------------------------------------------------------------------
  describe("3. Demo requests cannot access real authenticated users' workspace records", () => {
    it("returns 404 for project existing only in production database when requested from demo context", async () => {
      // Setup a project that exists strictly in DB
      const realDbProject = createMockProjectRow({
        id: "PRJ-REAL-EXCLUSIVE",
        workspaceId: "ws-real-production",
        name: "Classified Production Project",
      });

      // Demo request for that ID
      const req = createMockNextRequest({
        url: `http://localhost:3000/api/projects/${realDbProject.id}`,
      });

      const res = await getProjectById(req, { params: Promise.resolve({ id: realDbProject.id }) });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("Project not found");

      // Verify DB was never queried
      expect(db.getExecutedQueries().length).toBe(0);
    });

    it("returns 404 when demo mode tries to delete a project that exists only in production DB", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-REAL-EXCLUSIVE",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-REAL-EXCLUSIVE" }) });
      expect(res.status).toBe(404);

      expect(db.getExecutedQueries().length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Demo cookie is rejected in production and cannot authorize DB operations
  // --------------------------------------------------------------------------
  describe("4. Demo cookie is rejected in production and cannot authorize database operations", () => {
    it("getServerAuth rejects demo cookie in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockCookiesStore.set("realityos_demo_session", "1");

      const auth = await getServerAuth();
      expect(auth.status).toBe("unauthenticated");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(false);
    });

    it("rejects project mutation when demo cookie is sent in production environment", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockCookiesStore.set("realityos_demo_session", "1");

      // Route handler under unauthenticated state
      setAuthResult({
        status: "unauthenticated",
        user: null,
        profile: null,
        workspace: null,
        isDemo: false,
        reason: "Authentication service is not configured in production environment.",
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: { name: "Production Exploit Attempt", infraType: "Rail & Transit", region: "North" },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(401);

      // Verify no DB queries executed
      expect(db.getExecutedQueries().length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Missing Supabase configuration in production fails closed
  // --------------------------------------------------------------------------
  describe("5. Missing Supabase configuration in production fails closed", () => {
    it("fails closed when Supabase credentials are missing in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const auth = await getServerAuth();
      expect(auth.status).toBe("unauthenticated");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(false);
      expect((auth as { reason: string }).reason).toContain("production");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Switching between demo and authenticated contexts does not leak records
  // --------------------------------------------------------------------------
  describe("6. Context switching does not leak records between demo and authenticated environments", () => {
    it("keeps memoryStore records isolated from authenticated database queries", async () => {
      const realWorkspaceId = "ws-authenticated-alpha";

      // 1. Authenticated editor queries projects from DB
      setAuthResult(createMockAuthenticatedContext("editor", { workspaceId: realWorkspaceId }));
      db.queueResult([
        createMockProjectRow({
          id: "PRJ-DB-CORRIDOR",
          workspaceId: realWorkspaceId,
          name: "Authenticated Corridor Alpha",
        }),
      ]);

      const authReq = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const authRes = await getProjects(authReq);
      expect(authRes.status).toBe(200);
      const authProjects = await authRes.json();

      // Authenticated results contain DB record, NOT memory store seed
      expect(authProjects.some((p: { id: string }) => p.id === "PRJ-DB-CORRIDOR")).toBe(true);

      // 2. Switch to Demo context
      setAuthResult(createMockDemoContext());
      const demoReq = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const demoRes = await getProjects(demoReq);
      expect(demoRes.status).toBe(200);
      const demoProjects = await demoRes.json();

      // Demo results contain memoryStore projects, NEVER the DB record
      expect(demoProjects.some((p: { id: string }) => p.id === "PRJ-DB-CORRIDOR")).toBe(false);
    });
  });
});
