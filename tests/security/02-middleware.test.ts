import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockNextRequest, createMockSupabaseUser } from "../helpers/mock-auth";
import { createServerClient } from "@supabase/ssr";

// Hoisted state shared with vi.mock
const {
  isConfiguredState,
  setIsConfigured,
  getMockUser,
  setMockUser,
  getMockError,
} = vi.hoisted(() => {
  let configured = false;
  let user: any = null;
  let error: any = null;

  return {
    isConfiguredState: () => configured,
    setIsConfigured: (val: boolean) => {
      configured = val;
    },
    getMockUser: () => user,
    setMockUser: (u: any) => {
      user = u;
      error = null;
    },
    getMockError: () => error,
    setMockError: (e: any) => {
      error = e;
      user = null;
    },
  };
});

// 1. Mock @/lib/supabase/client so isSupabaseConfigured() is dynamically controllable
vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>();
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => isConfiguredState()),
  };
});

// 2. Mock @supabase/ssr createServerClient to simulate auth responses and cookie refresh
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, _options) => ({
    auth: {
      getUser: vi.fn(async () => {
        const error = getMockError();
        if (error) {
          return { data: { user: null }, error };
        }
        const user = getMockUser();
        return { data: { user }, error: null };
      }),
    },
  })),
}));

// Import middleware under test
import { updateSession } from "@/lib/supabase/middleware";

describe("02 - Middleware Security Test Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    setIsConfigured(false);
    setMockUser(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Unauthenticated requests to protected browser pages redirect to login
  // --------------------------------------------------------------------------
  describe("7. Unauthenticated browser page requests redirect to /login", () => {
    it.each([
      ["/overview", "/login?redirect=%2Foverview"],
      ["/projects", "/login?redirect=%2Fprojects"],
      ["/analytics", "/login?redirect=%2Fanalytics"],
      ["/settings", "/login?redirect=%2Fsettings"],
      ["/reports", "/login?redirect=%2Freports"],
    ])("redirects unauthenticated request to %s to %s", async (path, expectedRedirect) => {
      const req = createMockNextRequest({ url: `http://localhost:3000${path}` });
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBeDefined();
      expect(location).toContain(expectedRedirect);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Unauthenticated requests to protected /api/ paths receive JSON 401
  // --------------------------------------------------------------------------
  describe("8. Unauthenticated API requests receive JSON 401 (never 307 login redirect)", () => {
    it.each([
      ["/api/projects"],
      ["/api/projects/PRJ-1001"],
      ["/api/reports"],
      ["/api/reports/RPT-5001"],
      ["/api/ai/analyze"],
      ["/api/workspaces"],
    ])("returns 401 JSON response for %s instead of 307 redirect", async (apiPath) => {
      const req = createMockNextRequest({ url: `http://localhost:3000${apiPath}` });
      const res = await updateSession(req);

      expect(res.status).toBe(401);
      expect(res.headers.get("location")).toBeNull();

      const json = await res.json();
      expect(json).toEqual({ error: "Unauthorized" });
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Public API paths remain accessible through middleware
  // --------------------------------------------------------------------------
  describe("9. Public API paths remain accessible through middleware", () => {
    it("permits unauthenticated access to /api/health", async () => {
      const req = createMockNextRequest({ url: "http://localhost:3000/api/health" });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("permits unauthenticated access to /api/ai/status", async () => {
      const req = createMockNextRequest({ url: "http://localhost:3000/api/ai/status" });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Demo cookies do not grant access in production, but are permitted in development
  // --------------------------------------------------------------------------
  describe("10. Demo cookies do not bypass authentication in production, but are permitted in development", () => {
    it("rejects demo cookie in production on protected browser pages with redirect to login (Supabase unconfigured)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      setIsConfigured(false);

      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
        demoSession: true,
      });
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("rejects demo cookie in production on protected browser pages with redirect to login (Supabase configured)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      setIsConfigured(true);
      setMockUser(null);

      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
        demoSession: true,
      });
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("rejects demo cookie in production on API routes with JSON 401", async () => {
      vi.stubEnv("NODE_ENV", "production");
      setIsConfigured(true);
      setMockUser(null);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        demoSession: true,
      });
      const res = await updateSession(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "Unauthorized" });
    });

    it("permits demo cookie in local development when Supabase is configured", async () => {
      vi.stubEnv("NODE_ENV", "development");
      setIsConfigured(true);
      setMockUser(null);

      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
        demoSession: true,
      });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();

      const apiReq = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        demoSession: true,
      });
      const apiRes = await updateSession(apiReq);
      expect(apiRes.status).toBe(200);
    });

    it("permits demo cookie in local development when Supabase is unconfigured", async () => {
      vi.stubEnv("NODE_ENV", "development");
      setIsConfigured(false);

      const browserReq = createMockNextRequest({
        url: "http://localhost:3000/overview",
        demoSession: true,
      });
      const browserRes = await updateSession(browserReq);
      expect(browserRes.status).toBe(200);

      const apiReq = createMockNextRequest({
        url: "http://localhost:3000/api/projects",
        demoSession: true,
      });
      const apiRes = await updateSession(apiReq);
      expect(apiRes.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Public marketing routes and auth pages pass through
  // --------------------------------------------------------------------------
  describe("11. Public marketing and authentication pages remain publicly accessible", () => {
    it.each([
      ["/"],
      ["/privacy"],
      ["/terms"],
      ["/login"],
      ["/signup"],
      ["/forgot-password"],
      ["/reset-password"],
      ["/verify-email"],
    ])("allows unauthenticated visitor access to %s without redirect", async (publicRoute) => {
      const req = createMockNextRequest({ url: `http://localhost:3000${publicRoute}` });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Authenticated users are redirected away from /login and /signup
  // --------------------------------------------------------------------------
  describe("12. Authenticated users are redirected away from login/signup", () => {
    it("redirects authenticated user from /login to /overview by default", async () => {
      setIsConfigured(true);
      setMockUser(createMockSupabaseUser());

      const req = createMockNextRequest({ url: "http://localhost:3000/login" });
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/overview");
    });

    it("redirects authenticated user to requested safe redirect destination", async () => {
      setIsConfigured(true);
      setMockUser(createMockSupabaseUser());

      const req = createMockNextRequest({ url: "http://localhost:3000/login?redirect=%2Fprojects" });
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/projects");
    });

    it("prevents open redirect attacks by falling back to /overview for malicious URLs", async () => {
      setIsConfigured(true);
      setMockUser(createMockSupabaseUser());

      const req = createMockNextRequest({
        url: "http://localhost:3000/login?redirect=https%3A%2F%2Fmalicious-site.com",
      });
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/overview");
      expect(res.headers.get("location")).not.toContain("malicious-site.com");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Supabase SSR session cookie refresh
  // --------------------------------------------------------------------------
  describe("13. Middleware propagates refreshed Supabase session cookies", () => {
    it("attaches refreshed cookies to response when Supabase SSR client invokes setAll", async () => {
      setIsConfigured(true);
      const user = createMockSupabaseUser();
      setMockUser(user);

      vi.mocked(createServerClient).mockImplementationOnce((_url: string, _key: string, options: any) => {
        return {
          auth: {
            getUser: vi.fn(async () => {
              if (options?.cookies?.setAll) {
                options.cookies.setAll([
                  { name: "sb-mock-access-token", value: "token-refreshed-12345", options: { path: "/" } },
                  { name: "sb-mock-refresh-token", value: "refresh-refreshed-67890", options: { path: "/" } },
                ]);
              }
              return { data: { user }, error: null };
            }),
          },
        } as any;
      });

      const req = createMockNextRequest({ url: "http://localhost:3000/overview" });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(res.cookies.get("sb-mock-access-token")?.value).toBe("token-refreshed-12345");
      expect(res.cookies.get("sb-mock-refresh-token")?.value).toBe("refresh-refreshed-67890");
    });
  });
});
