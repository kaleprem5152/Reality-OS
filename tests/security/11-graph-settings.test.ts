import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockSupabaseUser,
  createMockAuthProfile,
  createMockDemoContext,
  createMockUnauthenticatedContext,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import { createMockDb, type MockDb } from "../helpers/mock-db";
import { buildWorkspaceGraph } from "@/lib/data/knowledge-graph";
import type { Project, Report } from "@/lib/types";

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

// Route handlers under test
import {
  GET as getMembers,
  PATCH as patchMembers,
  POST as postMembers,
} from "@/app/api/workspaces/members/route";
import { db as rawDb } from "@/db";

describe("11 - Knowledge Graph & Workspace Settings Security Test Suite", () => {
  const db = rawDb as unknown as MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
  });

  // =========================================================================
  // Part A: Knowledge Graph Dynamic Data Binding Tests
  // =========================================================================
  describe("Knowledge Graph Data Binding & Relationship Tracing", () => {
    const mockProjects: Project[] = [
      {
        id: "PRJ-1001",
        name: "North-South High Speed Metro",
        description: "Primary rapid transit trunk connecting northern hubs to financial core.",
        infraType: "Rail & Transit",
        region: "Northern Metropolitan",
        status: "In Delivery",
        budgetCrore: 14500,
        targetCompletion: "2030-Q4",
        riskLevel: "Moderate",
        capacityTarget: "800,000 daily passengers",
        sustainabilityPriorities: ["Regenerative braking", "Solar stations"],
        requirements: "High capacity zero emission transit corridor",
        stations: 28,
        corridorKm: 54.2,
        featured: true,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "PRJ-1002",
        name: "East Port Multimodal Freight Terminal",
        description: "Deepwater container port integration with direct railway freight connection.",
        infraType: "Ports & Logistics",
        region: "Eastern Maritime Belt",
        status: "Planning",
        budgetCrore: 9200,
        targetCompletion: "2032-Q2",
        riskLevel: "High",
        capacityTarget: "4.5 million TEU annually",
        sustainabilityPriorities: ["Shore power electrification"],
        requirements: "Electrified intermodal transfer terminal",
        stations: null,
        corridorKm: null,
        featured: false,
        archived: false,
        createdAt: "2026-01-10T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z",
      },
    ];

    const mockReports: Report[] = [
      {
        id: "RPT-5001",
        projectId: "PRJ-1001",
        title: "Environmental EIA Clearance Assessment",
        reportType: "Environmental Review",
        status: "Final",
        content: { executiveSummary: "Complies with statutory flood-plain thresholds." } as unknown as import("@/lib/types").ReportContent,
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "RPT-5002",
        projectId: "PRJ-1001",
        title: "Phase 1 Station Alignment & Geotechnical Survey",
        reportType: "Planning Analysis",
        status: "Draft",
        content: { executiveSummary: "Geotechnical test bores complete across 28 stations." } as unknown as import("@/lib/types").ReportContent,
        createdAt: "2026-02-15T00:00:00.000Z",
      },
    ];

    it("1. Dynamically constructs Project and Report nodes from real workspace data", () => {
      const { nodes, edges } = buildWorkspaceGraph(mockProjects, mockReports, "INR");

      // Verify PRJ-1001 node
      const prjNode = nodes.find((n) => n.id === "PRJ-1001");
      expect(prjNode).toBeDefined();
      expect(prjNode?.label).toBe("North-South High Speed Metro");
      expect(prjNode?.type).toBe("Project");
      expect(prjNode?.meta?.find((m) => m.label === "Budget")?.value).toBe("₹14500 cr");

      // Verify corridor sub-node generated for PRJ-1001 (corridorKm = 54.2)
      const corNode = nodes.find((n) => n.id === "PRJ-1001-COR");
      expect(corNode).toBeDefined();
      expect(corNode?.type).toBe("Corridor");
      expect(corNode?.meta?.find((m) => m.label === "Length")?.value).toBe("54.2 km");

      // Verify Report nodes
      const rpt1 = nodes.find((n) => n.id === "RPT-5001");
      const rpt2 = nodes.find((n) => n.id === "RPT-5002");
      expect(rpt1?.type).toBe("Report");
      expect(rpt2?.type).toBe("Report");
      expect(rpt1?.label).toBe("Environmental EIA Clearance Assessment");

      // Verify relationships: PRJ-1001 connects to RPT-5001 with 'evaluated by'
      const edge = edges.find((e) => e.source === "PRJ-1001" && e.target === "RPT-5001");
      expect(edge).toBeDefined();
      expect(edge?.relation).toBe("evaluated by");
    });

    it("2. Handles empty workspace data cleanly without runtime exceptions", () => {
      const { nodes, edges } = buildWorkspaceGraph([], [], "INR");
      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it("3. Honestly identifies unavailable external dependencies and milestones", () => {
      const { nodes } = buildWorkspaceGraph(mockProjects, [], "INR");
      const prj = nodes.find((n) => n.id === "PRJ-1002");
      const depMeta = prj?.meta?.find((m) => m.label === "Dependencies & Milestones");
      expect(depMeta).toBeDefined();
      expect(depMeta?.value).toContain("Unavailable");
    });

    it("4. Automatically removes stale nodes when project or report is deleted", () => {
      // Initially both reports exist
      const initial = buildWorkspaceGraph(mockProjects, mockReports, "INR");
      expect(initial.nodes.some((n) => n.id === "RPT-5002")).toBe(true);

      // Simulate deletion of RPT-5002
      const updatedReports = mockReports.filter((r) => r.id !== "RPT-5002");
      const updated = buildWorkspaceGraph(mockProjects, updatedReports, "INR");
      expect(updated.nodes.some((n) => n.id === "RPT-5002")).toBe(false);
      expect(updated.edges.some((e) => e.target === "RPT-5002")).toBe(false);
    });
  });

  // =========================================================================
  // Part B: Workspace Members List & Isolation Tests
  // =========================================================================
  describe("GET /api/workspaces/members", () => {
    it("5. Fails closed with 401 when unauthenticated", async () => {
      setApiAuthResult(createMockUnauthenticatedContext());
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "GET",
      });

      const res = await getMembers(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("6. Returns workspace members for the authorized workspace only", async () => {
      const auth = createMockAuthenticatedContext("admin", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const mockDbRows = [
        {
          membershipId: "mem-1",
          userId: "usr-admin-1",
          role: "admin",
          joinedAt: new Date("2026-01-01T00:00:00.000Z"),
          email: "chief.engineer@metro.gov.in",
          fullName: "Chief Transit Engineer",
          organization: "Metropolitan Authority",
        },
        {
          membershipId: "mem-2",
          userId: "usr-planner-2",
          role: "editor",
          joinedAt: new Date("2026-01-15T00:00:00.000Z"),
          email: "planner@metro.gov.in",
          fullName: "Senior Rail Planner",
          organization: "Metropolitan Authority",
        },
      ];

      db.queueResult(mockDbRows);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "GET",
      });

      const res = await getMembers(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members).toHaveLength(2);
      expect(data.members[0].fullName).toBe("Chief Transit Engineer");
      expect(data.members[0].role).toBe("admin");
      expect(data.currentUserRole).toBe("admin");
    });

    it("7. Fails closed with 500 when database throws an error", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      db.throwOnNext(new Error("FATAL: connection terminated unexpectedly"));

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "GET",
      });

      const res = await getMembers(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Failed to fetch workspace members.");
      expect(data.error).not.toContain("FATAL");
    });

    it("8. Operates in-memory in demo mode without querying PostgreSQL", async () => {
      setApiAuthResult(createMockDemoContext());

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "GET",
      });

      const res = await getMembers(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isDemo).toBe(true);
      expect(data.members.length).toBeGreaterThan(0);
      // Zero database calls
      expect(db.getExecutedQueries()).toHaveLength(0);
    });
  });

  // =========================================================================
  // Part C: Role Management & RBAC Enforcement Tests
  // =========================================================================
  describe("PATCH /api/workspaces/members", () => {
    it("9. Allows workspace owner or admin to update member role", async () => {
      const auth = createMockAuthenticatedContext("owner", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const targetMember = {
        membershipId: "mem-target-1",
        userId: "usr-other-user",
        role: "editor",
      };

      const updatedRow = {
        id: "mem-target-1",
        userId: "usr-other-user",
        role: "admin",
      };

      // 1. SELECT verifying member in workspace
      // 2. UPDATE returning row
      db.queueResults([targetMember], [updatedRow]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "PATCH",
        body: {
          memberId: "mem-target-1",
          role: "admin",
        },
      });

      const res = await patchMembers(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.member.role).toBe("admin");
    });

    it("10. Rejects editor attempts to modify member roles with 403 Forbidden", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "PATCH",
        body: {
          memberId: "mem-target-1",
          role: "admin",
        },
      });

      const res = await patchMembers(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Only workspace owners and administrators");
      expect(db.getExecutedQueries()).toHaveLength(0);
    });

    it("11. Rejects viewer attempts to modify member roles with 403 Forbidden", async () => {
      const auth = createMockAuthenticatedContext("viewer", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "PATCH",
        body: {
          memberId: "mem-target-1",
          role: "editor",
        },
      });

      const res = await patchMembers(req);
      expect(res.status).toBe(403);
      expect(db.getExecutedQueries()).toHaveLength(0);
    });

    it("12. Blocks self-promotion by preventing users from modifying their own role", async () => {
      const auth = createMockAuthenticatedContext("admin", {
        userId: "usr-admin-1",
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      // Target member has same userId as caller
      const targetMember = {
        membershipId: "mem-admin-1",
        userId: "usr-admin-1",
        role: "admin",
      };

      db.queueResult([targetMember]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "PATCH",
        body: {
          memberId: "mem-admin-1",
          role: "viewer",
        },
      });

      const res = await patchMembers(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("You cannot modify your own workspace role.");
    });

    it("13. Prevents non-owner administrators from promoting someone to owner", async () => {
      const auth = createMockAuthenticatedContext("admin", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "PATCH",
        body: {
          memberId: "mem-editor-2",
          role: "owner",
        },
      });

      const res = await patchMembers(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Only workspace owners can assign the owner role.");
    });
  });

  // =========================================================================
  // Part D: Workspace Invitations & Honest Provider Notice Tests
  // =========================================================================
  describe("POST /api/workspaces/members (Invitations)", () => {
    it("14. Allows owner/admin to create invitations and returns honest email provider notice", async () => {
      const auth = createMockAuthenticatedContext("owner", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const createdInvitation = {
        id: "inv-uuid-101",
        workspaceId: "ws-metro-north",
        email: "newplanner@metropolitan.gov.in",
        role: "editor",
        status: "pending",
      };

      db.queueResult([createdInvitation]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: {
          email: "newplanner@metropolitan.gov.in",
          role: "editor",
        },
      });

      const res = await postMembers(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.invitation.email).toBe("newplanner@metropolitan.gov.in");
      expect(data.invitation.status).toBe("pending");
      // Direct invite link provided
      expect(data.invitation.directInviteLink).toContain("/auth/callback?invitation=");
      // Notice transparently explains no outbound email provider is configured
      expect(data.invitation.notice).toContain("No outbound email service");
    });

    it("15. Rejects editor attempts to invite collaborators with 403 Forbidden", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: {
          email: "candidate@metro.gov.in",
          role: "viewer",
        },
      });

      const res = await postMembers(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Only workspace owners and administrators");
      expect(db.getExecutedQueries()).toHaveLength(0);
    });

    it("16. Rejects invalid email formats or disallowed roles", async () => {
      const auth = createMockAuthenticatedContext("admin", {
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/workspaces/members",
        method: "POST",
        body: {
          email: "not-an-email",
          role: "viewer",
        },
      });

      const res = await postMembers(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Valid email is required");
    });
  });
});
