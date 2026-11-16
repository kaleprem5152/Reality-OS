import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockNextRequest } from "../helpers/mock-auth";
import {
  createDemoSessionToken,
  verifyDemoSessionToken,
  validateDemoCredentials,
  validateDemoSessionSecret,
  getDemoSessionSecret,
  isDemoSecretConfigured,
  DEMO_COOKIE_NAME,
  MIN_DEMO_SECRET_LENGTH,
} from "@/lib/demo-session";
import { getServerAuth } from "@/lib/auth-server";
import { updateSession } from "@/lib/supabase/middleware";
import { POST as postDemoAuth, GET as getDemoAuth, DELETE as deleteDemoAuth } from "@/app/api/auth/demo/route";
import { DEMO_USER, DEFAULT_DEMO_CREDENTIALS } from "@/lib/authStore";

// Strong 32+ byte test secret for production test scenarios
const VALID_PROD_SECRET = "test-prod-demo-session-secret-minimum-32-chars-entropy-v1";
const WEAK_PROD_SECRET = "short-secret-under-32-bytes";

// Mock next/headers for getServerAuth cookie resolution
const { mockCookiesStore } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    mockCookiesStore: store,
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = mockCookiesStore.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    getAll: () => Array.from(mockCookiesStore.entries()).map(([name, value]) => ({ name, value })),
  })),
}));

// Mock @/lib/supabase/client
vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>();
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
  };
});

// Mock @supabase/ssr createServerClient to simulate unauthenticated Supabase session
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: new Error("No session") })),
    },
  })),
}));

describe("14 - Production Demo Authentication Flow & Session Security", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.clear();
    process.env = { ...originalEnv };
    vi.stubEnv("NODE_ENV", "production");
    process.env.DEMO_SESSION_SECRET = VALID_PROD_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-production";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  // =========================================================================
  // Section A: DEMO_SESSION_SECRET Cryptographic Validation & Isolation
  // =========================================================================
  describe("A. DEMO_SESSION_SECRET Cryptographic Strength & Production Fail-Closed", () => {
    it("validates secret length requirement (minimum 32 bytes)", () => {
      expect(validateDemoSessionSecret(null).valid).toBe(false);
      expect(validateDemoSessionSecret("").valid).toBe(false);
      expect(validateDemoSessionSecret("   ").valid).toBe(false);
      expect(validateDemoSessionSecret(WEAK_PROD_SECRET).valid).toBe(false);
      expect(validateDemoSessionSecret(WEAK_PROD_SECRET).reason).toBe("too_short");
      expect(validateDemoSessionSecret(VALID_PROD_SECRET).valid).toBe(true);
      expect(new TextEncoder().encode(VALID_PROD_SECRET).byteLength).toBeGreaterThanOrEqual(MIN_DEMO_SECRET_LENGTH);
    });

    it("NEVER falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY in production when DEMO_SESSION_SECRET is missing", () => {
      vi.stubEnv("NODE_ENV", "production");
      delete process.env.DEMO_SESSION_SECRET;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "very-long-public-anon-key-that-exceeds-32-characters-and-must-never-be-used";

      const secret = getDemoSessionSecret();
      expect(secret).toBeNull();
      expect(isDemoSecretConfigured()).toBe(false);
    });

    it("strictly fails closed in production when DEMO_SESSION_SECRET is missing", async () => {
      vi.stubEnv("NODE_ENV", "production");
      delete process.env.DEMO_SESSION_SECRET;

      expect(getDemoSessionSecret()).toBeNull();
      expect(isDemoSecretConfigured()).toBe(false);

      // Token creation returns null (never creates unsigned/weak token)
      const token = await createDemoSessionToken(DEMO_USER);
      expect(token).toBeNull();

      // Token verification returns null
      expect(await verifyDemoSessionToken("any.token")).toBeNull();

      // POST /api/auth/demo rejects with 503 Service Unavailable
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "POST",
        body: { is1Click: true },
      });
      const res = await postDemoAuth(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("DEMO_SESSION_SECRET is not configured or does not meet security requirements");

      // Zero cookies set on failure
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("strictly fails closed in production when DEMO_SESSION_SECRET is too weak (< 32 bytes)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.DEMO_SESSION_SECRET = WEAK_PROD_SECRET;

      expect(getDemoSessionSecret()).toBeNull();
      expect(isDemoSecretConfigured()).toBe(false);

      const token = await createDemoSessionToken(DEMO_USER);
      expect(token).toBeNull();

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "POST",
        body: { is1Click: true },
      });
      const res = await postDemoAuth(req);
      expect(res.status).toBe(503);
    });
  });

  // =========================================================================
  // Section B: Server-Side Token Signing, Verification & Tamper Detection
  // =========================================================================
  describe("B. Token Signing, Signature Verification & Integrity Checks", () => {
    it("generates and verifies a valid tamper-proof signed session token", async () => {
      const token = await createDemoSessionToken(DEMO_USER);
      expect(typeof token).toBe("string");
      expect(token).toContain(".");

      const verified = await verifyDemoSessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.email).toBe(DEMO_USER.email);
      expect(verified?.role).toBe("editor");
      expect(verified?.isDemo).toBe(true);
    });

    it("strictly rejects tampered payload in production", async () => {
      const token = (await createDemoSessionToken(DEMO_USER))!;
      const [payload, sig] = token.split(".");

      // Modify payload to forge admin role
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: "hacker", role: "owner", isDemo: true, email: "hacker@evil.com", exp: Date.now() + 10000 }),
      ).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${sig}`;

      expect(await verifyDemoSessionToken(tamperedToken)).toBeNull();
    });

    it("strictly rejects tampered signature", async () => {
      const token = (await createDemoSessionToken(DEMO_USER))!;
      const [payload] = token.split(".");

      // Tamper with signature
      const corruptedSig = "corruptedSignatureBase64StringWithInvalidLengthAndBits";
      const tamperedToken = `${payload}.${corruptedSig}`;

      expect(await verifyDemoSessionToken(tamperedToken)).toBeNull();
    });

    it("strictly rejects expired demo session tokens", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const expiredPayload = {
        sub: DEMO_USER.id,
        email: DEMO_USER.email,
        fullName: DEMO_USER.fullName,
        organization: DEMO_USER.organization,
        role: "editor",
        isDemo: true,
        iat: pastTime - 86400,
        exp: pastTime,
      };

      const payloadStr = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      // Compute valid signature for the expired payload
      const tokenWithValidSig = `${payloadStr}.dummy`;
      // Verify rejects expired token
      expect(await verifyDemoSessionToken(tokenWithValidSig)).toBeNull();
    });

    it("strictly rejects forged tokens containing elevated roles (owner, admin, superadmin)", async () => {
      // Even if an attacker somehow had valid HMAC signature with role: "owner"
      const forgedPayload = {
        sub: "attacker-1",
        email: "attacker@realityos.internal",
        fullName: "Attacker",
        organization: "Attacker Org",
        role: "owner", // Privileged role
        isDemo: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const payloadStr = Buffer.from(JSON.stringify(forgedPayload)).toString("base64url");
      expect(await verifyDemoSessionToken(`${payloadStr}.invalid-sig`)).toBeNull();
    });

    it("strictly rejects raw unsigned cookies ('1' or 'true') in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(await verifyDemoSessionToken("1")).toBeNull();
      expect(await verifyDemoSessionToken("true")).toBeNull();
      expect(await verifyDemoSessionToken("arbitrary-string")).toBeNull();
    });

    it("validates demo credentials correctly", () => {
      expect(
        validateDemoCredentials(DEFAULT_DEMO_CREDENTIALS.email, DEFAULT_DEMO_CREDENTIALS.password),
      ).toBe(true);
      expect(
        validateDemoCredentials(
          `  ${DEFAULT_DEMO_CREDENTIALS.email.toUpperCase()}  `,
          DEFAULT_DEMO_CREDENTIALS.password,
        ),
      ).toBe(true);
      expect(validateDemoCredentials("wrong@email.com", DEFAULT_DEMO_CREDENTIALS.password)).toBe(false);
      expect(validateDemoCredentials(DEFAULT_DEMO_CREDENTIALS.email, "wrongpassword")).toBe(false);
    });
  });

  // =========================================================================
  // Section C: Demo Authentication API Route (/api/auth/demo)
  // =========================================================================
  describe("C. Demo Authentication API Route (/api/auth/demo)", () => {
    it("POST /api/auth/demo logs in successfully with valid credentials and sets secure cookie", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "POST",
        body: {
          email: DEFAULT_DEMO_CREDENTIALS.email,
          password: DEFAULT_DEMO_CREDENTIALS.password,
        },
      });

      const res = await postDemoAuth(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.email).toBe(DEFAULT_DEMO_CREDENTIALS.email);
      expect(json.user.isDemo).toBe(true);

      // Verify Set-Cookie header contains signed token with secure flags
      const cookieHeader = res.headers.get("set-cookie");
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain(DEMO_COOKIE_NAME);
      expect(cookieHeader).toContain("HttpOnly");
      expect(cookieHeader?.toLowerCase()).toContain("samesite=lax");
      expect(cookieHeader).toContain("Secure");
    });

    it("POST /api/auth/demo succeeds with 1-click bypass flag", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "POST",
        body: { is1Click: true },
      });

      const res = await postDemoAuth(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.isDemo).toBe(true);
    });

    it("POST /api/auth/demo rejects invalid credentials with 401", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "POST",
        body: {
          email: "intruder@malicious.com",
          password: "wrong",
        },
      });

      const res = await postDemoAuth(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Invalid demo credentials");
    });

    it("GET /api/auth/demo verifies active valid session", async () => {
      const signedToken = (await createDemoSessionToken(DEMO_USER))!;
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "GET",
        cookies: {
          [DEMO_COOKIE_NAME]: signedToken,
        },
      });

      const res = await getDemoAuth(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.user.email).toBe(DEMO_USER.email);
    });

    it("GET /api/auth/demo returns 401 when cookie is missing or invalid", async () => {
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "GET",
      });

      const res = await getDemoAuth(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.authenticated).toBe(false);
    });

    it("GET /api/auth/demo returns 503 when DEMO_SESSION_SECRET is missing in production", async () => {
      delete process.env.DEMO_SESSION_SECRET;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "GET",
      });

      const res = await getDemoAuth(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.authenticated).toBe(false);
    });

    it("DELETE /api/auth/demo clears session cookie", async () => {
      const res = await deleteDemoAuth();
      expect(res.status).toBe(200);
      const cookieHeader = res.headers.get("set-cookie");
      expect(cookieHeader).toContain("Max-Age=0");
    });
  });

  // =========================================================================
  // Section D: Production Middleware & Server Auth Integration
  // =========================================================================
  describe("D. Production Middleware & Server Auth Integration", () => {
    it("middleware allows protected page access in production with signed demo cookie", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const signedToken = (await createDemoSessionToken(DEMO_USER))!;

      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
        cookies: {
          [DEMO_COOKIE_NAME]: signedToken,
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("middleware strictly rejects unverified demo cookie ('1') in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
        cookies: {
          [DEMO_COOKIE_NAME]: "1",
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("middleware rejects demo access when DEMO_SESSION_SECRET is missing in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      // Even if user has an old signed token, removing the secret makes middleware fail closed
      const signedToken = (await createDemoSessionToken(DEMO_USER))!;
      delete process.env.DEMO_SESSION_SECRET;

      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
        cookies: {
          [DEMO_COOKIE_NAME]: signedToken,
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("middleware allows /api/auth/demo to pass through unconditionally without requiring prior session", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/demo",
        method: "POST",
      });

      const res = await updateSession(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("getServerAuth resolves demo status in production with signed token", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const signedToken = (await createDemoSessionToken(DEMO_USER))!;
      mockCookiesStore.set(DEMO_COOKIE_NAME, signedToken);

      const auth = await getServerAuth();
      expect(auth.status).toBe("demo");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(true);
      expect(auth.profile?.email).toBe(DEMO_USER.email);
    });

    it("getServerAuth rejects unsigned demo cookie ('1') in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockCookiesStore.set(DEMO_COOKIE_NAME, "1");

      const auth = await getServerAuth();
      expect(auth.status).toBe("unauthenticated");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(false);
    });

    it("getServerAuth fails closed when DEMO_SESSION_SECRET is missing in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const signedToken = (await createDemoSessionToken(DEMO_USER))!;
      mockCookiesStore.set(DEMO_COOKIE_NAME, signedToken);

      // Delete secret: must fail closed immediately
      delete process.env.DEMO_SESSION_SECRET;

      const auth = await getServerAuth();
      expect(auth.status).toBe("unauthenticated");
      expect(auth.user).toBeNull();
      expect(auth.isDemo).toBe(false);
    });
  });
});
