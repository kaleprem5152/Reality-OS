import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import {
  createMockProjectRow,
  type MockDb,
} from "../helpers/mock-db";
import { getServerAuth } from "@/lib/auth-server";
import { memoryStore } from "@/lib/memory-store";

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

// 1. Mock DB to inject failures and verify fail-closed behavior
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// 2. Mock authenticateApiRequest so route handlers can be tested under verified authenticated context
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

describe("06 - Fail-Closed and Upstream Error Handling Security Test Suite", () => {
  const db = rawDb as unknown as MockDb;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    process.env = { ...originalEnv };
    vi.stubEnv("NODE_ENV", "development");
    process.env.GEMINI_API_KEY = "mock-server-gemini-key";
    setAuthResult(createMockAuthenticatedContext("admin"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Database SELECT failures return sanitized 500 responses
  // --------------------------------------------------------------------------
  describe("7. Database SELECT failures return sanitized 500 responses", () => {
    it("GET /api/projects fails closed with 500 when SELECT query fails", async () => {
      db.throwOnNext(new Error("Postgres query connection timeout"));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const res = await getProjects(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to fetch projects." });
    });

    it("GET /api/projects/[id] fails closed with 500 when SELECT query fails", async () => {
      db.throwOnNext(new Error("Connection reset by peer"));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects/PRJ-1001" });
      const res = await getProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to fetch project." });
    });

    it("GET /api/reports fails closed with 500 when SELECT query fails", async () => {
      db.throwOnNext(new Error("Deadlock detected during select"));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports" });
      const res = await getReports(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to fetch reports." });
    });

    it("GET /api/reports/[id] fails closed with 500 when SELECT query fails", async () => {
      db.throwOnNext(new Error("I/O error reading database block"));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001" });
      const res = await getReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to fetch report." });
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Database INSERT, UPDATE, and DELETE failures return sanitized 500 responses
  // --------------------------------------------------------------------------
  describe("8. Database mutation failures return sanitized 500 responses", () => {
    it("POST /api/projects fails closed with 500 when DB insert fails", async () => {
      // Query 1: Existing IDs lookup succeeds
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Insert throws DB error
      db.throwOnNext(new Error("Disk quota exceeded"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Fault Tolerant Corridor",
          infraType: "Rail & Transit",
          region: "Central",
          budgetCrore: 3200,
          targetCompletion: "2030",
        },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to create project." });
    });

    it("PATCH /api/projects/[id] fails closed with 500 when DB update fails", async () => {
      // Query 1: Lookup succeeds
      db.queueResult([{ id: "PRJ-1001" }]);
      // Query 2: Update throws DB error
      db.throwOnNext(new Error("Constraint violation"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "PATCH",
        body: { name: "New Name Attempt" },
      });

      const res = await patchProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to update project." });
    });

    it("DELETE /api/projects/[id] fails closed with 500 when DB delete fails", async () => {
      // Query 1: Lookup succeeds
      db.queueResult([{ id: "PRJ-1001", createdBy: "usr-admin-1" }]);
      // Query 2: Cascade report delete throws
      db.throwOnNext(new Error("Foreign key constraint violation"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects/PRJ-1001",
        method: "DELETE",
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: "PRJ-1001" }) });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to delete project." });
    });

    it("POST /api/reports fails closed with 500 when parent project lookup throws", async () => {
      db.throwOnNext(new Error("Database connection dropped"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: "PRJ-1001",
          title: "Assessment",
          reportType: "Feasibility",
          content: { note: "test" },
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to create report." });
    });

    it("DELETE /api/reports/[id] fails closed with 500 when DB delete fails", async () => {
      db.queueResult([{ id: "RPT-5001", createdBy: "usr-admin-1" }]);
      db.throwOnNext(new Error("Database transaction aborted"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "DELETE",
      });

      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to delete report." });
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 9: No database failure silently falls back to the memory store
  // --------------------------------------------------------------------------
  describe("9. Database failures never silently fall back to memoryStore", () => {
    it("fails with 500 on GET /api/projects without returning in-memory demo projects", async () => {
      db.throwOnNext(new Error("Database unreachable"));

      const memoryProjectCount = memoryStore.getProjects().length;
      expect(memoryProjectCount).toBeGreaterThan(0);

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const res = await getProjects(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(false);
      expect(json.error).toBe("Failed to fetch projects.");
    });

    it("fails with 500 on POST /api/projects without writing to memoryStore", async () => {
      db.queueResult([{ id: "PRJ-1001" }]);
      db.throwOnNext(new Error("Database unreachable"));

      const initialMemoryCount = memoryStore.getProjects().length;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        method: "POST",
        body: {
          name: "Should Not Fallback To Memory",
          infraType: "Rail & Transit",
          region: "Central",
          budgetCrore: 2000,
          targetCompletion: "2030",
        },
      });

      const res = await postProjects(req);
      expect(res.status).toBe(500);

      // Verify memoryStore did NOT receive the project
      expect(memoryStore.getProjects().length).toBe(initialMemoryCount);
      expect(memoryStore.getProjects().some((p) => p.name === "Should Not Fallback To Memory")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Errors do not expose SQL, connection strings, IPs, or credentials
  // --------------------------------------------------------------------------
  describe("10. Error responses never leak sensitive technical internals", () => {
    it("sanitizes database error messages containing passwords, IPs, ports, and SQL", async () => {
      const sensitiveLeak =
        "FATAL: password authentication failed for user 'postgres' at postgresql://postgres:super_secret_pw@192.168.1.100:5432/realityos SELECT * FROM projects WHERE token = 'bearer_token_12345'";
      db.throwOnNext(new Error(sensitiveLeak));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      const res = await getProjects(req);

      expect(res.status).toBe(500);
      const rawText = await res.text();

      // Assert none of the sensitive tokens leaked into the HTTP response body
      expect(rawText).not.toContain("super_secret_pw");
      expect(rawText).not.toContain("192.168.1.100");
      expect(rawText).not.toContain("5432");
      expect(rawText).not.toContain("bearer_token_12345");
      expect(rawText).not.toContain("SELECT * FROM");
      expect(rawText).toContain("Failed to fetch projects.");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Gemini timeout and upstream failure responses remain sanitized
  // --------------------------------------------------------------------------
  describe("11. Gemini timeout and upstream failure responses remain sanitized", () => {
    it("handles Gemini AbortError timeout with sanitized 502 response without leaking secrets", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "Analyze network resiliency under peak loads." },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(502);

      const json = await res.json();
      expect(json.configured).toBe(true);
      expect(json.error).toBe("Gemini request timed out after 30s.");
      expect(JSON.stringify(json)).not.toContain("mock-server-gemini-key");
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("handles Gemini upstream 500 error with sanitized 502 response", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Internal server error in upstream model server" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "Analyze network expansion." },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(502);

      const json = await res.json();
      expect(json.configured).toBe(true);
      expect(json.error).toBe("Gemini request failed. Please try again or switch to demo analysis mode.");
      expect(JSON.stringify(json)).not.toContain("mock-server-gemini-key");
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Gemini rate-limit responses preserve the intended 429 status without exposing secrets
  // --------------------------------------------------------------------------
  describe("12. Gemini rate-limit responses return 429 without exposing secrets", () => {
    it("returns 429 with sanitized rate limit error message when upstream returns 429", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Quota exceeded for quota metric 'Queries'" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "Run capacity stress test." },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.configured).toBe(true);
      expect(json.error).toBe("Gemini rate limit reached. Wait a moment and retry, or use demo analysis mode.");
      expect(JSON.stringify(json)).not.toContain("mock-server-gemini-key");
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Unexpected external network calls fail the test unless explicitly expected
  // --------------------------------------------------------------------------
  describe("13. Zero unexpected external network calls on database failures or unauthenticated routes", () => {
    it("makes zero network calls when database fails during project operations", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      db.throwOnNext(new Error("Database down"));

      const req = createMockNextRequest({ url: "http://localhost:3000/api/projects" });
      await getProjects(req);

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Invalid or missing auth configuration fails closed in production
  // --------------------------------------------------------------------------
  describe("14. Missing or invalid auth configuration fails closed in production", () => {
    it("fails closed when Supabase configuration is missing in production", async () => {
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
});
