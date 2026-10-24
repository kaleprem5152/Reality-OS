import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockNextRequest,
  createMockUnauthenticatedContext,
  createMockDemoContext,
  createMockForbiddenContext,
  createMockNoWorkspaceContext,
} from "../helpers/mock-auth";
import type { ApiAuthResult } from "@/lib/api-auth";
import { getServerAuth } from "@/lib/auth-server";
import { createApiAuthErrorResponse } from "@/lib/api-auth";

// Hoisted state shared with vi.mock
const { getAuthResult, setAuthResult, mockCookiesStore } = vi.hoisted(() => {
  let currentAuth: any = {
    status: "unauthenticated",
    user: null,
    profile: null,
    workspace: null,
    isDemo: false,
    reason: "No active session",
  };
  const store = new Map<string, string>();
  return {
    getAuthResult: () => currentAuth,
    setAuthResult: (r: any) => {
      currentAuth = r;
    },
    mockCookiesStore: store,
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

// 2. Mock next/headers so getServerAuth can read test cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = mockCookiesStore.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    getAll: () => Array.from(mockCookiesStore.entries()).map(([name, value]) => ({ name, value })),
  })),
}));

// 3. Mock authenticateApiRequest so route handlers can be tested across auth states
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getAuthResult()),
  };
});

// Import route handlers under test
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
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getAiStatus } from "@/app/api/ai/status/route";

describe("01 - Authentication and API Security Test Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.clear();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.GEMINI_API_KEY;
    setAuthResult(createMockUnauthenticatedContext());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Unauthenticated project and report requests return JSON 401
  // --------------------------------------------------------------------------
  describe("1. Unauthenticated project and report requests return JSON 401", () => {
    it("rejects GET /api/projects when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext("No session"));
      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects", method: "GET" });
      const res = await getProjects(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "No session" });
    });

    it("rejects POST /api/projects when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext("Session expired"));
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: { name: "Unauthorized Project", infraType: "Rail & Transit", region: "North" },
      });
      const res = await postProjects(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "Session expired" });
    });

    it("rejects GET /api/projects/[id] when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects/PRJ-1001", method: "GET" });
      const res = await getProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("rejects PATCH /api/projects/[id] when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { name: "Hacked Project" },
      });
      const res = await patchProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("rejects DELETE /api/projects/[id] when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects/PRJ-1001", method: "DELETE" });
      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("rejects GET /api/reports when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports", method: "GET" });
      const res = await getReports(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("rejects POST /api/reports when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: { projectId: "PRJ-1001", title: "New Report", reportType: "Feasibility" },
      });
      const res = await postReports(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("rejects GET /api/reports/[id] when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001", method: "GET" });
      const res = await getReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("rejects DELETE /api/reports/[id] when unauthenticated with 401 Unauthorized", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001", method: "DELETE" });
      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Unauthenticated AI-analysis requests return 401 before checking
  // Gemini key or calling external services
  // --------------------------------------------------------------------------
  describe("2. Unauthenticated AI analysis rejects before key check or network call", () => {
    it("returns 401 without inspecting missing or configured GEMINI_API_KEY", async () => {
      setAuthResult(createMockUnauthenticatedContext("Authentication required."));
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      // Verify with GEMINI_API_KEY unset
      delete process.env.GEMINI_API_KEY;
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "Analyze rail network expansion." },
      });
      const res = await postAiAnalyze(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "Authentication required." });
      expect(fetchSpy).not.toHaveBeenCalled();

      // Verify with a mock GEMINI_API_KEY present — must still fail closed with 401
      process.env.GEMINI_API_KEY = "test-gemini-key";
      const res2 = await postAiAnalyze(req);
      expect(res2.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns 401 even when request body is empty or malformed", async () => {
      setAuthResult(createMockUnauthenticatedContext());
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const req = new NextRequest("http://localhost:3000/api/ai/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "malformed-json-body{{{",
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Demo analysis uses deterministic local output and never calls Gemini
  // --------------------------------------------------------------------------
  describe("3. Demo analysis uses deterministic local output without external API calls", () => {
    it("generates structured planning analysis locally in demo mode without calling Gemini", async () => {
      setAuthResult(createMockDemoContext());
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          projectName: "Capital Metro Line",
          infraType: "Rail & Transit",
          region: "Capital Region",
          budgetCrore: 3500,
          requirements: "Construct a 25km grade-separated mass transit line connecting east and west suburbs.",
          objectives: ["Improve peak transit throughput", "Reduce highway carbon emissions"],
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.analysis).toBeDefined();
      expect(json.analysis.executiveSummary).toBeTruthy();

      // Validate presence of deterministic five agents
      const agentNames = json.analysis.agents.map((a: { agent: string }) => a.agent);
      expect(agentNames).toContain("Transportation Planning");
      expect(agentNames).toContain("Financial Analysis");
      expect(agentNames).toContain("Environmental Assessment");
      expect(agentNames).toContain("Utilities & Dependencies");
      expect(agentNames).toContain("Risk Analysis");

      // Verify external Gemini endpoint was NOT called
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Production mode rejects demo-cookie authentication
  // --------------------------------------------------------------------------
  describe("4. Production mode rejects demo-cookie authentication", () => {
    it("getServerAuth rejects demo cookie when NODE_ENV is production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockCookiesStore.set("realityos_demo_session", "1");

      const auth = await getServerAuth();
      expect(auth.status).toBe("unauthenticated");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(false);
      expect((auth as { reason: string }).reason).toContain("production");
    });

    it("getServerAuth permits demo cookie only in non-production environments when Supabase is unconfigured", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesStore.set("realityos_demo_session", "1");

      const auth = await getServerAuth();
      expect(auth.status).toBe("demo");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(true);
      if (auth.status === "demo") {
        expect(auth.profile.fullName).toBe("Lead Infrastructure Planner");
      }
    });

    it("getServerAuth fails closed in development when demo cookie is missing", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesStore.clear();

      const auth = await getServerAuth();
      expect(auth.status).toBe("unauthenticated");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Public health and AI-status routes remain publicly accessible
  // --------------------------------------------------------------------------
  describe("5. Public health and AI-status routes remain publicly accessible", () => {
    it("GET /api/health responds with 200 without requiring authentication", async () => {
      const res = await getHealth();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("healthy");
      expect(json.app).toBe("RealityOS");
      expect(json.timestamp).toBeDefined();
    });

    it("GET /api/ai/status responds with 200 without requiring authentication", async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await getAiStatus();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.configured).toBe(false);
      expect(json.provider).toBeNull();

      // When GEMINI_API_KEY is configured
      process.env.GEMINI_API_KEY = "test-api-key";
      const resConfigured = await getAiStatus();
      const jsonConfigured = await resConfigured.json();
      expect(jsonConfigured.configured).toBe(true);
      expect(jsonConfigured.provider).toBe("gemini");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Authentication errors fail closed without exposing internal details
  // --------------------------------------------------------------------------
  describe("6. Authentication errors fail closed without exposing internal details", () => {
    it("createApiAuthErrorResponse sanitizes unauthenticated reasons into standard 401 response", () => {
      const unauthContext = createMockUnauthenticatedContext("Sensitive token validation error: token_expired_epoch_17000000");
      const res = createApiAuthErrorResponse(unauthContext);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
    });

    it("createApiAuthErrorResponse sanitizes forbidden state without exposing internal workspace IDs", () => {
      const forbiddenContext = createMockForbiddenContext("User usr-123 denied access to private workspace ws-secret-999");
      const res = createApiAuthErrorResponse(forbiddenContext);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("createApiAuthErrorResponse returns 403 when user has no workspace membership", () => {
      const noWsContext = createMockNoWorkspaceContext();
      const res = createApiAuthErrorResponse(noWsContext);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("createApiAuthErrorResponse returns 500 without database error exposure on internal error status", () => {
      const errorContext = {
        status: "error" as const,
        user: null,
        profile: null,
        workspace: null,
        isDemo: false as const,
        reason: "FATAL: Connection refused at postgresql://postgres:secret@db:5432/realityos",
      };
      const res = createApiAuthErrorResponse(errorContext);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(500);
    });
  });
});
