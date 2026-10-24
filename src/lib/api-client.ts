"use client";

import type { Project, Report } from "@/lib/types";

import { getSupabase } from "@/lib/supabase";

/** Thin fetch wrapper for the RealityOS API routes. */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // Ignore session retrieval error on unauthenticated requests
    }
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ProjectUpsert {
  name: string;
  description: string;
  infraType: string;
  region: string;
  status: string;
  budgetCrore: number;
  targetCompletion: string;
  riskLevel: string;
  capacityTarget: string;
  sustainabilityPriorities: string[];
  requirements: string;
  stations?: number | null;
  corridorKm?: number | null;
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (data: ProjectUpsert) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<ProjectUpsert> & { archived?: boolean; status?: string }) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),

  listReports: () => request<Report[]>("/api/reports"),
  getReport: (id: string) => request<Report>(`/api/reports/${id}`),
  createReport: (data: { projectId: string; title: string; reportType: string; status?: string; content: unknown }) =>
    request<Report>("/api/reports", { method: "POST", body: JSON.stringify(data) }),
  updateReport: (id: string, data: Partial<{ title: string; status: string; content: unknown }>) =>
    request<Report>(`/api/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteReport: (id: string) =>
    request<{ ok: boolean }>(`/api/reports/${id}`, { method: "DELETE" }),

  aiStatus: () => request<{ configured: boolean; provider: string | null }>("/api/ai/status"),
  aiAnalyze: (payload: {
    projectId: string;
    projectName: string;
    infraType: string;
    region: string;
    budgetCrore: number;
    requirements: string;
    objectives: string[];
    sustainabilityPriorities: string[];
  }) =>
    request<{ analysis: unknown }>("/api/ai/analyze", { method: "POST", body: JSON.stringify(payload) }),

  createWorkspace: (name?: string) =>
    request<{
      success: boolean;
      workspace: { id: string; name: string; role: string };
      alreadyExists?: boolean;
    }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }),

  getWorkspaces: () =>
    request<{
      workspaces: Array<{ id: string; name: string; role: string; joinedAt?: string }>;
    }>("/api/workspaces"),

  listMembers: () =>
    request<{
      members: Array<{
        id: string;
        userId: string;
        email: string;
        fullName: string;
        organization: string;
        role: "owner" | "admin" | "editor" | "viewer";
        joinedAt: string;
      }>;
      isDemo: boolean;
      currentUserRole: string;
    }>("/api/workspaces/members"),

  updateMemberRole: (memberId: string, role: string) =>
    request<{
      success: boolean;
      member: { id: string; userId: string; role: string };
    }>("/api/workspaces/members", {
      method: "PATCH",
      body: JSON.stringify({ memberId, role }),
    }),

  inviteMember: (email: string, role: string) =>
    request<{
      success: boolean;
      invitation: {
        id?: string;
        email: string;
        role: string;
        status: string;
        directInviteLink: string;
        emailDelivered: boolean;
        notice: string;
      };
    }>("/api/workspaces/members", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),

  getInvitationPreview: (token: string) =>
    request<{
      valid: boolean;
      workspaceName?: string;
      role?: string;
      email?: string;
      expiresAt?: string;
      error?: string;
    }>(`/api/workspaces/invitations/accept?token=${encodeURIComponent(token)}`),

  acceptInvitation: (token: string) =>
    request<{
      success: boolean;
      workspaceId: string;
      role: string;
      alreadyMember: boolean;
    }>("/api/workspaces/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};
