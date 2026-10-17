"use client";

import type { Project, Report } from "@/lib/types";

/** Thin fetch wrapper for the RealityOS API routes. */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
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
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (data: ProjectUpsert) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<ProjectUpsert> & { archived?: boolean; status?: string }) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),

  listReports: () => request<Report[]>("/api/reports"),
  createReport: (data: { projectId: string; title: string; reportType: string; status?: string; content: unknown }) =>
    request<Report>("/api/reports", { method: "POST", body: JSON.stringify(data) }),
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
};
