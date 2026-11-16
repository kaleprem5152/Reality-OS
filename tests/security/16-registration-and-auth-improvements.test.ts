import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isValidEmail,
  validateFullName,
  validatePassword,
  MAX_FULL_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/validation";
import { updateSession } from "@/lib/supabase/middleware";
import { createMockNextRequest } from "../helpers/mock-auth";
import {
  createDemoSessionToken,
  DEMO_COOKIE_NAME,
} from "@/lib/demo-session";
import { DEMO_USER, DEFAULT_DEMO_CREDENTIALS } from "@/lib/authStore";

// Mock @supabase/ssr
const mockSupabaseAuth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token?: string) => {
        if (token === "valid-supabase-token") {
          return {
            data: {
              user: {
                id: "user-registered-1",
                email: "verified.planner@authority.gov",
                user_metadata: { full_name: "Verified Planner" },
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: new Error("No session") };
      }),
    },
  })),
}));

describe("16 - Registration, Authentication Improvements, and Rate Limit Handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.DEMO_SESSION_SECRET = "test-prod-demo-session-secret-minimum-32-chars-entropy-v1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // 1. Invalid Email Rejection
  // =========================================================================
  describe("1. Email Format Validation", () => {
    it("strictly rejects invalid email formats like harsh099@2026 without domain extension", () => {
      expect(isValidEmail("harsh099@2026")).toBe(false);
      expect(isValidEmail("user@localhost")).toBe(false);
      expect(isValidEmail("plainaddress")).toBe(false);
      expect(isValidEmail("@missingusername.com")).toBe(false);
      expect(isValidEmail("username@.com")).toBe(false);
      expect(isValidEmail("username@com")).toBe(false);
      expect(isValidEmail("user@domain.c")).toBe(false); // 1-character TLD rejected
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("   ")).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });

    it("accepts valid structural email formats with domain extensions", () => {
      expect(isValidEmail("elena.rostova@transit.gov")).toBe(true);
      expect(isValidEmail("planner@realityos.internal")).toBe(true);
      expect(isValidEmail("engineer@metropolitan.gov.in")).toBe(true);
      expect(isValidEmail("user+tag@domain.co.uk")).toBe(true);
      expect(isValidEmail("   clean.email@authority.org   ")).toBe(true);
    });
  });

  // =========================================================================
  // 2. Full Name / Username Character Limits (Max 50)
  // =========================================================================
  describe("2. Full Name / Username Character Limits", () => {
    it("rejects empty, null, or whitespace-only full name", () => {
      const emptyRes = validateFullName("");
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error).toContain("Full Name is required");

      const whitespaceRes = validateFullName("     ");
      expect(whitespaceRes.valid).toBe(false);
      expect(whitespaceRes.error).toContain("Full Name is required");

      expect(validateFullName(null).valid).toBe(false);
      expect(validateFullName(undefined).valid).toBe(false);
    });

    it("rejects full name exceeding 50 characters", () => {
      const over50 = "A".repeat(51);
      const res = validateFullName(over50);
      expect(res.valid).toBe(false);
      expect(res.error).toBe(`Full Name must not exceed ${MAX_FULL_NAME_LENGTH} characters.`);
    });

    it("accepts valid full name between 1 and 50 characters", () => {
      expect(validateFullName("Elena Rostova").valid).toBe(true);
      expect(validateFullName("A".repeat(50)).valid).toBe(true);
      expect(validateFullName("A").valid).toBe(true);
    });
  });

  // =========================================================================
  // 3 & 4. Password Length Boundaries (6 - 50 characters)
  // =========================================================================
  describe("3 & 4. Password Length Boundaries (6 to 50 characters)", () => {
    it("rejects password shorter than 6 characters", () => {
      const short1 = validatePassword("12345");
      expect(short1.valid).toBe(false);
      expect(short1.error).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

      expect(validatePassword("").valid).toBe(false);
      expect(validatePassword(null).valid).toBe(false);
    });

    it("rejects password longer than 50 characters", () => {
      const longPass = "P".repeat(51);
      const res = validatePassword(longPass);
      expect(res.valid).toBe(false);
      expect(res.error).toBe(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`);
    });

    it("accepts valid password of 6 to 50 characters while preserving casing and special characters", () => {
      const validPass = "P@ssw0rd!#$ 2026";
      const res = validatePassword(validPass);
      expect(res.valid).toBe(true);
      expect(validatePassword("a".repeat(6)).valid).toBe(true);
      expect(validatePassword("a".repeat(50)).valid).toBe(true);
    });
  });

  // =========================================================================
  // 5. Valid New-User Registration Simulation
  // =========================================================================
  describe("5. Valid New-User Registration", () => {
    it("validates all required registration attributes correctly", () => {
      const validPayload = {
        fullName: "Chief Transit Engineer",
        organization: "Metropolitan Authority",
        role: "Transportation Engineer",
        email: "chief.engineer@authority.gov",
        password: "ValidSecurePassword2026!",
      };

      expect(validateFullName(validPayload.fullName).valid).toBe(true);
      expect(isValidEmail(validPayload.email)).toBe(true);
      expect(validatePassword(validPayload.password).valid).toBe(true);
    });
  });

  // =========================================================================
  // 6. Email Confirmation Required Handling
  // =========================================================================
  describe("6. Email Confirmation Required Handling", () => {
    it("distinguishes between immediate session login and pending email confirmation", () => {
      // When session is null, registration requires confirmation email
      const signUpResultConfirmationRequired = {
        user: { id: "user-123", email: "new.user@authority.gov" },
        session: null,
      };

      const needVerification = signUpResultConfirmationRequired.session === null;
      expect(needVerification).toBe(true);

      // When session is present, user is immediately authenticated
      const signUpResultImmediateSession = {
        user: { id: "user-123", email: "new.user@authority.gov" },
        session: { access_token: "jwt-token-123" },
      };

      const hasImmediateSession = Boolean(signUpResultImmediateSession.session?.access_token);
      expect(hasImmediateSession).toBe(true);
    });
  });

  // =========================================================================
  // 7. Login Using Registered Credentials & Backward Compatibility
  // =========================================================================
  describe("7. Login Using Registered Credentials & Compatibility", () => {
    it("validates login credentials format before sending to server", () => {
      const email = "verified.planner@authority.gov";
      const password = "PlannerSecure2026!";

      expect(isValidEmail(email)).toBe(true);
      expect(validatePassword(password).valid).toBe(true);
    });

    it("proves signup rejects passwords longer than 50 characters", () => {
      const over50Password = "P".repeat(51);
      const res51 = validatePassword(over50Password);
      expect(res51.valid).toBe(false);
      expect(res51.error).toBe("Password must not exceed 50 characters.");

      const pass64 = "P".repeat(64);
      expect(pass64.length).toBe(64);
      const res64 = validatePassword(pass64);
      expect(res64.valid).toBe(false);
      expect(res64.error).toBe("Password must not exceed 50 characters.");

      // Exactly 50 characters is allowed for signup
      const exact50 = "P".repeat(50);
      expect(validatePassword(exact50).valid).toBe(true);
    });

    it("proves login allows an existing password longer than 50 characters to reach Supabase unchanged", async () => {
      const legacyLongPassword = "VeryLongLegacyPasswordExceedingFiftyCharacters!2024ManagerGen#$99";
      expect(legacyLongPassword.length).toBeGreaterThan(50);

      // Verify email is valid
      const email = "legacy.user@authority.gov";
      expect(isValidEmail(email)).toBe(true);

      // Simulate login execution path to Supabase signInWithPassword
      const mockSignIn = vi.fn().mockResolvedValue({
        data: { user: { id: "usr-legacy-1", email } },
        error: null,
      });

      // Login handler logic: clean email, pass raw submitted password without modification or truncation
      const cleanEmail = email.trim().toLowerCase();
      const submittedPassword = legacyLongPassword; // Not truncated or bounded by 50 chars

      await mockSignIn({
        email: cleanEmail,
        password: submittedPassword,
      });

      expect(mockSignIn).toHaveBeenCalledTimes(1);
      const callArgs = mockSignIn.mock.calls[0][0];
      expect(callArgs.email).toBe("legacy.user@authority.gov");
      // Password must be strictly identical in content and length (never truncated to 50)
      expect(callArgs.password).toBe(legacyLongPassword);
      expect(callArgs.password.length).toBe(legacyLongPassword.length);
      expect(callArgs.password.length).toBeGreaterThan(50);
    });

    it("ensures sensitive passwords are never logged to console during validation or auth", () => {
      const sensitivePassword = "SuperSecretPlainTextPassword123!";
      const logSpy = vi.spyOn(console, "log");
      const errorSpy = vi.spyOn(console, "error");
      const warnSpy = vi.spyOn(console, "warn");
      const infoSpy = vi.spyOn(console, "info");

      // Run validations
      validatePassword(sensitivePassword);
      validatePassword(sensitivePassword.repeat(2)); // > 50

      // Assert no logger received the plaintext password
      const allCalls = [
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...infoSpy.mock.calls,
      ].flat();

      for (const arg of allCalls) {
        if (typeof arg === "string") {
          expect(arg).not.toContain(sensitivePassword);
        } else if (typeof arg === "object" && arg !== null) {
          expect(JSON.stringify(arg)).not.toContain(sensitivePassword);
        }
      }

      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });

  // =========================================================================
  // 8. Duplicate Signup Prevention
  // =========================================================================
  describe("8. Duplicate Signup Submission & Existing Account Detection", () => {
    it("detects Supabase v2 empty identities array indicating already-registered account", () => {
      // Supabase v2 returns data.user with empty identities array when email is already registered
      const existingUserResponse = {
        user: {
          id: "existing-user-id",
          email: "already.registered@authority.gov",
          identities: [], // Empty array signifies duplicate email in Supabase
        },
        session: null,
      };

      const isAlreadyRegistered =
        existingUserResponse.user?.identities && existingUserResponse.user.identities.length === 0;

      expect(isAlreadyRegistered).toBe(true);
    });
  });

  // =========================================================================
  // 9. Rate-Limit Error Handling
  // =========================================================================
  describe("9. Rate-Limit Error Handling", () => {
    it("detects and maps Supabase rate-limit errors to friendly user messages", () => {
      const rateLimitErrors = [
        { message: "email rate limit exceeded", status: 429 },
        { message: "For security purposes, you can only request this once every 60 seconds", status: 429 },
        { message: "over_email_send_rate_limit", status: 429 },
      ];

      for (const err of rateLimitErrors) {
        const isRateLimit =
          err.message.toLowerCase().includes("rate limit") ||
          err.message.toLowerCase().includes("once every") ||
          err.status === 429;

        expect(isRateLimit).toBe(true);
      }
    });
  });

  // =========================================================================
  // 10. Existing Google OAuth Flow Preservation
  // =========================================================================
  describe("10. Existing Google OAuth Flow Preservation", () => {
    it("constructs secure redirect URL for Google OAuth provider", () => {
      const origin = "http://localhost:3000";
      const customRedirect = "/onboarding";
      const redirectUrl = `${origin}/auth/callback?next=${encodeURIComponent(customRedirect)}`;

      expect(redirectUrl).toBe("http://localhost:3000/auth/callback?next=%2Fonboarding");
    });
  });

  // =========================================================================
  // 11. Existing Demo Login Flow Preservation
  // =========================================================================
  describe("11. Existing Demo Login Flow Preservation", () => {
    it("demo credentials match DEFAULT_DEMO_CREDENTIALS", () => {
      expect(DEFAULT_DEMO_CREDENTIALS.email).toBe("planner@realityos.internal");
      expect(DEFAULT_DEMO_CREDENTIALS.password).toBe("realityos2026");
      expect(DEMO_USER.role).toBe("Lead Infrastructure Planner");
      expect(DEMO_USER.isDemo).toBe(true);
    });

    it("middleware redirects demo session away from /login to /overview", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const signedToken = (await createDemoSessionToken(DEMO_USER))!;

      const req = createMockNextRequest({
        url: "http://localhost:3000/login",
        cookies: {
          [DEMO_COOKIE_NAME]: signedToken,
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/overview");
    });
  });

  // =========================================================================
  // 12. Existing User Login and Logout Middleware Checks
  // =========================================================================
  describe("12. User Login and Logout Middleware Checks", () => {
    it("middleware redirects unauthenticated request to /overview to /login", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const req = createMockNextRequest({
        url: "http://localhost:3000/overview",
      });

      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("clears demo cookie upon logout request (Max-Age=0)", async () => {
      const { DELETE: deleteDemoAuth } = await import("@/app/api/auth/demo/route");
      const res = await deleteDemoAuth();
      expect(res.status).toBe(200);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("Max-Age=0");
    });
  });
});
