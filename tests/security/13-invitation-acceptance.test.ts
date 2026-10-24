import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { createMockNextRequest, createMockSupabaseUser } from "../helpers/mock-auth";
import { createMockDb, type MockDb } from "../helpers/mock-db";

// Hoisted state
const { getAuthUser, setAuthUser } = vi.hoisted(() => {
  let currentUser: any = null;
  return {
    getAuthUser: () => currentUser,
    setAuthUser: (u: any) => {
      currentUser = u;
    },
  };
});

// 1. Mock DB
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// 2. Mock getServerAuth
vi.mock("@/lib/auth-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-server")>();
  return {
    ...actual,
    getServerAuth: vi.fn(async () => {
      const user = getAuthUser();
      if (!user) {
        return {
          status: "unauthenticated",
          user: null,
          profile: null,
          isDemo: false,
          reason: "No active session",
        };
      }
      return {
        status: "authenticated",
        user,
        profile: {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || "Planner",
          organization: "Metropolitan Authority",
          role: "Lead Infrastructure Planner",
        },
        isDemo: false,
      };
    }),
  };
});

// 3. Mock @/lib/supabase/server to return null so the direct db transaction path is executed
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => null),
}));

// Import route handlers under test
import {
  GET as getInvitationPreview,
  POST as postAcceptInvitation,
} from "@/app/api/workspaces/invitations/accept/route";
import { db as rawDb } from "@/db";

describe("13 - Workspace Invitation Acceptance & Security Test Suite", () => {
  const db = rawDb as unknown as MockDb;
  const originalEnv = process.env;

  const TEST_WS_ID = "ws-metro-001";
  const TEST_INVITED_EMAIL = "newplanner@agency.gov";

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    process.env = { ...originalEnv };
    vi.stubEnv("NODE_ENV", "production");
    setAuthUser(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  function createTestInvitationRow(options: {
    rawToken?: string;
    email?: string;
    role?: "admin" | "editor" | "viewer";
    status?: "pending" | "accepted" | "revoked" | "expired";
    expiresAt?: Date;
  } = {}) {
    const rawToken = options.rawToken || "tok-uuid-12345";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const email = options.email || TEST_INVITED_EMAIL;
    const role = options.role || "editor";
    const status = options.status || "pending";
    const expiresAt = options.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const row = {
      id: "inv-101",
      workspaceId: TEST_WS_ID,
      workspaceName: "Metropolitan Transit Authority",
      email,
      role,
      tokenHash,
      invitedBy: "usr-admin-owner",
      status,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { rawToken, tokenHash, email, role, status, row };
  }

  // ==========================================================================
  // 1. Authentication & Parameter Validation
  // ==========================================================================
  describe("1. Authentication and Input Validation", () => {
    it("rejects unauthenticated invitation acceptance with 401 Unauthorized", async () => {
      setAuthUser(null);
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: "any-token-uuid" },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Authentication required");
    });

    it("rejects acceptance requests with missing or empty token with 400 Bad Request", async () => {
      const user = createMockSupabaseUser({ id: "usr-1", email: TEST_INVITED_EMAIL });
      setAuthUser(user);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: "   " },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invitation token is required");
    });
  });

  // ==========================================================================
  // 2. Token Validation & Email Mismatch Enforcement
  // ==========================================================================
  describe("2. Token Validation and Email Mismatch Checks", () => {
    it("rejects invalid or non-existent token with 404 Not Found", async () => {
      const user = createMockSupabaseUser({ id: "usr-1", email: TEST_INVITED_EMAIL });
      setAuthUser(user);

      db.queueResult([]); // No invitation found

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: "non-existent-token-uuid" },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Invalid or non-existent");
    });

    it("rejects acceptance when authenticated user email does not match invited email (403 Forbidden)", async () => {
      const { rawToken, row } = createTestInvitationRow({ email: "intended.invitee@agency.gov" });
      db.queueResult([row]); // Invitation found

      // Sign in as a different user
      const wrongUser = createMockSupabaseUser({
        id: "usr-wrong",
        email: "attacker@external.org",
      });
      setAuthUser(wrongUser);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: rawToken },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Invitation email does not match authenticated user");
    });
  });

  // ==========================================================================
  // 3. Successful Acceptance & Atomic Membership Creation
  // ==========================================================================
  describe("3. Successful Acceptance and Role Assignment", () => {
    it("accepts valid invitation, creates membership with exact role, and marks status accepted", async () => {
      const { rawToken, row } = createTestInvitationRow({
        email: TEST_INVITED_EMAIL,
        role: "editor",
      });

      // Query 1: select invitation -> [row]
      // Query 2: select existing membership -> [] (not already member)
      // Query 3: update invitation
      // Query 4: insert membership
      db.queueResults([row], [], [], []);

      const validUser = createMockSupabaseUser({
        id: "usr-new-planner",
        email: TEST_INVITED_EMAIL,
      });
      setAuthUser(validUser);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: rawToken },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.workspaceId).toBe(TEST_WS_ID);
      expect(json.role).toBe("editor");
      expect(json.alreadyMember).toBe(false);
    });

    it("strictly prevents privilege escalation: granted role is immutable from invitation row", async () => {
      const { rawToken, row } = createTestInvitationRow({
        email: TEST_INVITED_EMAIL,
        role: "viewer",
      });

      db.queueResults([row], [], [], []);

      const validUser = createMockSupabaseUser({
        id: "usr-viewer-planner",
        email: TEST_INVITED_EMAIL,
      });
      setAuthUser(validUser);

      // Attempt to send body claiming owner or admin privileges
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: rawToken, role: "owner", workspaceId: "ws-hacked" },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // Verified: assigned role is strictly "viewer" from stored record
      expect(json.role).toBe("viewer");
      expect(json.workspaceId).toBe(TEST_WS_ID);
    });
  });

  // ==========================================================================
  // 4. Single-Use Replay Prevention & Expiration
  // ==========================================================================
  describe("4. Single-Use Replay Protection and Expiry", () => {
    it("rejects replay attempt on an already accepted invitation (410 Gone)", async () => {
      const { rawToken, row } = createTestInvitationRow({
        email: TEST_INVITED_EMAIL,
        role: "editor",
        status: "accepted",
      });

      db.queueResult([row]); // Returns invitation with status: "accepted"

      const user = createMockSupabaseUser({
        id: "usr-replay",
        email: TEST_INVITED_EMAIL,
      });
      setAuthUser(user);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: rawToken },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toContain("Invitation is no longer active");
    });

    it("rejects expired invitation, marks status as expired, and returns 410 Gone", async () => {
      const expiredDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      const { rawToken, row } = createTestInvitationRow({
        email: TEST_INVITED_EMAIL,
        expiresAt: expiredDate,
      });

      // Query 1: select invitation -> returns expired row
      // Query 2: update status to 'expired'
      db.queueResults([row], []);

      const user = createMockSupabaseUser({
        id: "usr-expired",
        email: TEST_INVITED_EMAIL,
      });
      setAuthUser(user);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: rawToken },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toContain("Invitation has expired");
    });

    it("handles idempotent acceptance when user is already a member without error", async () => {
      const { rawToken, row } = createTestInvitationRow({
        email: TEST_INVITED_EMAIL,
        role: "viewer",
      });

      // Query 1: select invitation -> [row]
      // Query 2: select existing membership -> [{ id: "mem-1", role: "editor" }]
      // Query 3: update invitation to accepted
      db.queueResults([row], [{ id: "mem-1", role: "editor" }], []);

      const user = createMockSupabaseUser({
        id: "usr-existing-member",
        email: TEST_INVITED_EMAIL,
      });
      setAuthUser(user);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/invitations/accept",
        method: "POST",
        body: { token: rawToken },
      });

      const res = await postAcceptInvitation(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.alreadyMember).toBe(true);
      // Preserved existing role without demoting
      expect(json.role).toBe("editor");
    });
  });

  // ==========================================================================
  // 5. Invitation Preview Endpoint (GET)
  // ==========================================================================
  describe("5. Invitation Preview Endpoint (GET)", () => {
    it("returns workspace name and role metadata without consuming the token", async () => {
      const { rawToken, row } = createTestInvitationRow({
        email: TEST_INVITED_EMAIL,
        role: "editor",
      });

      // Preview query returns joined row
      db.queueResult([row]);

      const req = new NextRequest(
        `http://localhost:3000/api/workspaces/invitations/accept?token=${rawToken}`,
      );

      const res = await getInvitationPreview(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.valid).toBe(true);
      expect(json.workspaceName).toBe("Metropolitan Transit Authority");
      expect(json.role).toBe("editor");
      expect(json.email).toBe(TEST_INVITED_EMAIL);
    });

    it("returns 404 for invalid or non-existent token preview", async () => {
      db.queueResult([]); // Not found

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/invitations/accept?token=unknown-token-1234",
      );

      const res = await getInvitationPreview(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.valid).toBe(false);
      expect(json.error).toContain("Invalid or non-existent");
    });
  });
});
