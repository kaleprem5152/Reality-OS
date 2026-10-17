"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisResult, AppSettings, Project, Report } from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  loadCurrentProjectId,
  loadSettings,
  saveCurrentProjectId,
  saveSettings,
} from "@/lib/settings-service";
import { api } from "@/lib/api-client";

interface Notification {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
}

interface AppState {
  loading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  projects: Project[];
  activeProjects: Project[];
  featuredProject: Project | null;
  currentProject: Project | null;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
  createProject: (p: Parameters<typeof api.createProject>[0]) => Promise<Project>;
  updateProject: (id: string, p: Parameters<typeof api.updateProject>[1]) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  reports: Report[];
  createReport: (r: Parameters<typeof api.createReport>[0]) => Promise<Report>;
  deleteReport: (id: string) => Promise<void>;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  notifications: Notification[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  studioResult: AnalysisResult | null;
  setStudioResult: (r: AnalysisResult | null, target?: { navigateToReports: boolean }) => void;
  studioHandoff: { projectId: string; requirements: string; objectives: string[] } | null;
  requestStudioRun: (payload: { projectId: string; requirements: string; objectives: string[] }) => void;
  clearStudioHandoff: () => void;
  /** Number of scenario configurations evaluated: 3 calibrated presets + session runs. */
  simRunCount: number;
  recordSimRun: (n?: number) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: "N-1",
    title: "Scenario evaluation due",
    detail: "Metro Intelligence — Phase 1 scenario pack is due for Steering Group review.",
    time: new Date(Date.now() - 2.5 * 36e5).toISOString(),
    read: false,
  },
  {
    id: "N-2",
    title: "Utility conflict flagged",
    detail: "Water trunk main crossing unresolved on Line B · Airport Link corridor.",
    time: new Date(Date.now() - 26 * 36e5).toISOString(),
    read: false,
  },
  {
    id: "N-3",
    title: "Analysis completed",
    detail: "Structured planning analysis finished for Metro Intelligence (demo mode).",
    time: new Date(Date.now() - 50 * 36e5).toISOString(),
    read: false,
  },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(SEED_NOTIFICATIONS);
  const [studioResult, setStudioResultState] = useState<AnalysisResult | null>(null);
  const [studioHandoff, setStudioHandoff] = useState<AppState["studioHandoff"]>(null);
  const [simRunCount, setSimRunCount] = useState(3); // three calibrated presets ship with the workspace
  const studioNavigateRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, r] = await Promise.all([api.listProjects(), api.listReports()]);
      setProjects(p);
      setReports(r);
      setSettings(loadSettings());
      const stored = loadCurrentProjectId();
      const featured = p.find((x) => x.featured && !x.archived) ?? p.find((x) => !x.archived) ?? null;
      const wanted = stored && p.some((x) => x.id === stored) ? stored : featured?.id ?? null;
      setCurrentProjectIdState(wanted);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load workspace data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Single global Ctrl/Cmd+K shortcut registration (one source of truth). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const t = e.target as HTMLElement | null;
        const typing =
          t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
        if (typing) return;
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const featuredProject = useMemo(
    () => projects.find((p) => p.featured && !p.archived) ?? null,
    [projects],
  );
  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? featuredProject,
    [projects, currentProjectId, featuredProject],
  );

  const setCurrentProjectId = useCallback((id: string) => {
    setCurrentProjectIdState(id);
    saveCurrentProjectId(id);
  }, []);

  const createProject = useCallback(async (p: Parameters<typeof api.createProject>[0]) => {
    const created = await api.createProject(p);
    setProjects((prev) => [...prev, created]);
    return created;
  }, []);

  const updateProject = useCallback(async (id: string, p: Parameters<typeof api.updateProject>[1]) => {
    const updated = await api.updateProject(id, p);
    setProjects((prev) => prev.map((x) => (x.id === id ? updated : x)));
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((x) => x.id !== id));
    setReports((prev) => prev.filter((r) => r.projectId !== id));
  }, []);

  const createReport = useCallback(async (r: Parameters<typeof api.createReport>[0]) => {
    const created = await api.createReport(r);
    setReports((prev) => [created, ...prev]);
    return created;
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    await api.deleteReport(id);
    setReports((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const markAllNotificationsRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  );
  const markNotificationRead = useCallback(
    (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [],
  );

  const setStudioResult = useCallback(
    (r: AnalysisResult | null, target?: { navigateToReports: boolean }) => {
      setStudioResultState(r);
      studioNavigateRef.current = target?.navigateToReports ?? false;
    },
    [],
  );

  const requestStudioRun = useCallback(
    (payload: { projectId: string; requirements: string; objectives: string[] }) => {
      setStudioHandoff(payload);
    },
    [],
  );
  const clearStudioHandoff = useCallback(() => setStudioHandoff(null), []);

  const recordSimRun = useCallback((n = 1) => setSimRunCount((c) => c + n), []);

  const value: AppState = {
    loading,
    loadError,
    retryLoad: load,
    projects,
    activeProjects,
    featuredProject,
    currentProject,
    currentProjectId,
    setCurrentProjectId,
    createProject,
    updateProject,
    deleteProject,
    reports,
    createReport,
    deleteReport,
    settings,
    updateSettings,
    sidebarCollapsed,
    toggleSidebar,
    paletteOpen,
    setPaletteOpen,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAllNotificationsRead,
    markNotificationRead,
    studioResult,
    setStudioResult,
    studioHandoff,
    requestStudioRun,
    clearStudioHandoff,
    simRunCount,
    recordSimRun,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
