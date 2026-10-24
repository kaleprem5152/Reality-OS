import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth-server";
import {
  authenticateApiRequest,
  jsonInternalError,
  jsonUnauthorized,
} from "@/lib/api-auth";
import { createWorkspaceForUser } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);

  if (auth.status === "unauthenticated") {
    return jsonUnauthorized(auth.reason || "Unauthorized");
  }

  if (auth.status === "demo") {
    return NextResponse.json({
      workspaces: [
        {
          id: auth.workspace.workspaceId,
          name: auth.workspace.workspaceName,
          role: auth.workspace.role,
        },
      ],
    });
  }

  if (auth.status === "no_workspace") {
    return NextResponse.json({ workspaces: [] });
  }

  if (auth.status === "authenticated") {
    return NextResponse.json({
      workspaces: auth.allMemberships.map((m) => ({
        id: m.workspaceId,
        name: m.workspaceName,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    });
  }

  return jsonInternalError(auth.reason || "Failed to resolve workspaces.");
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();

  if (auth.status === "unauthenticated") {
    return jsonUnauthorized(auth.reason || "Unauthorized");
  }

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Optional JSON body; default name will be used
  }

  // Local/offline demo mode: return virtual demo workspace
  if (auth.status === "demo") {
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    return NextResponse.json(
      {
        success: true,
        workspace: {
          id: "demo-workspace",
          name: rawName.length >= 3 ? rawName : "Demonstration Authority Workspace",
          role: "editor",
        },
        alreadyExists: true,
      },
      { status: 200 },
    );
  }

  // Authenticated Supabase session: provision real workspace in database
  try {
    const rawName = typeof body?.name === "string" ? body.name.trim() : undefined;
    const defaultName =
      auth.profile.organization && auth.profile.organization !== "Metropolitan Authority"
        ? `${auth.profile.organization} Workspace`
        : "Metropolitan Infrastructure Workspace";
    const name = rawName && rawName.length >= 3 ? rawName : defaultName;

    const result = await createWorkspaceForUser(auth.user, name);

    return NextResponse.json(
      {
        success: true,
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
          role: result.workspace.role,
        },
        alreadyExists: result.alreadyExists,
      },
      { status: result.alreadyExists ? 200 : 201 },
    );
  } catch (err) {
    console.error("Failed to create workspace:", err);
    return jsonInternalError("Failed to create workspace.");
  }
}
