"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check, ChevronDown, CircleUser, LogOut, Search } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { cx, timeAgo } from "@/lib/format";

const CRUMB_LABELS: Record<string, string> = {
  "": "Overview",
  overview: "Overview",
  projects: "Projects",
  studio: "AI Planning Studio",
  geo: "Geo Intelligence",
  twin: "Digital Twin",
  graph: "Knowledge Graph",
  reports: "Reports & Evidence",
  settings: "Settings",
};

function useAiStatus() {
  const [status, setStatus] = useState<{ configured: boolean; provider: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => alive && setStatus(d))
      .catch(() => alive && setStatus({ configured: false, provider: null }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeProjects, currentProject, currentProjectId, setCurrentProjectId,
    notifications, unreadCount, markAllNotificationsRead, markNotificationRead, setPaletteOpen,
  } = useApp();
  const { user, signOut } = useAuth();
  const ai = useAiStatus();

  const [projOpen, setProjOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const projRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!projRef.current?.contains(e.target as Node)) setProjOpen(false);
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
      if (!userRef.current?.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const crumbs = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    const out: { label: string; href: string }[] = [{ label: "Overview", href: "/overview" }];
    let acc = "";
    segs.forEach((s, i) => {
      acc += `/${s}`;
      if (s === "projects" && segs[i + 1]) {
        out.push({ label: "Projects", href: "/projects" });
        out.push({ label: currentProject?.id === segs[i + 1] ? currentProject.name : segs[i + 1], href: acc });
        return;
      }
      if (out.some((c) => c.href === acc)) return;
      out.push({ label: CRUMB_LABELS[s] ?? s, href: acc });
    });
    // de-dup while keeping order
    const seen = new Set<string>();
    return out.filter((c) => (seen.has(c.href) ? false : (seen.add(c.href), true)));
  }, [pathname, currentProject]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-[rgba(10,11,13,0.85)] px-5 backdrop-blur-sm">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[12px] md:flex">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="text-faint">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-ink" aria-current="page">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate text-muted transition-colors hover:text-ink">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Project selector */}
      <div ref={projRef} className="relative hidden lg:block">
        <button
          type="button"
          onClick={() => setProjOpen((v) => !v)}
          className="btn btn-secondary max-w-[260px]"
          aria-expanded={projOpen}
          aria-label="Select current project"
        >
          <span className="truncate">{currentProject ? currentProject.name : "Select project"}</span>
          <ChevronDown size={13} className={cx("shrink-0 transition-transform", projOpen && "rotate-180")} aria-hidden />
        </button>
        {projOpen && (
          <div className="anim-pop absolute right-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-md border border-line bg-surface shadow-pop">
            <p className="border-b border-line px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
              Current project context
            </p>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setCurrentProjectId(p.id);
                    setProjOpen(false);
                    if (pathname.startsWith("/projects")) router.push(`/projects/${p.id}`);
                  }}
                  className={cx(
                    "flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left transition-colors hover:bg-app-bg",
                    p.id === currentProjectId && "bg-primary-soft/60",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-ink">{p.name}</span>
                    <span className="block text-[10.5px] text-muted">{p.id} · {p.infraType}</span>
                  </span>
                  {p.id === currentProjectId && <Check size={13} className="shrink-0 text-primary" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Global search */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="btn btn-secondary min-w-[170px] justify-start text-muted"
        aria-label="Open global search"
      >
        <Search size={13.5} aria-hidden />
        <span className="text-[12px]">Search…</span>
        <kbd className="ml-auto rounded border border-line bg-app-bg px-1.5 py-0.5 text-[10px] font-medium text-muted">⌘K</kbd>
      </button>

      {/* AI status */}
      <div
        className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-[7px] text-[11px] font-medium text-ink-2 xl:flex"
        title={ai?.configured ? "Gemini API key configured on the server" : "No AI key configured — Studio runs deterministic demo analysis"}
      >
        <span
          className={cx("h-[7px] w-[7px] rounded-full", ai?.configured ? "bg-success" : "bg-warning")}
          aria-hidden
        />
        {ai === null ? "AI: checking…" : ai.configured ? "AI: Gemini" : "AI: Demo mode"}
      </div>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          className="relative grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-ink"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={notifOpen}
        >
          <Bell size={15} aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-[#0A0B0D]">
              {unreadCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="anim-pop absolute right-0 top-full z-40 mt-1.5 w-88 overflow-hidden rounded-md border border-line bg-surface shadow-pop" style={{ width: 340 }}>
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Notifications</p>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllNotificationsRead} className="text-[11px] font-medium text-primary hover:text-primary-hover">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markNotificationRead(n.id)}
                  className={cx(
                    "block w-full border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-app-bg",
                    !n.read && "bg-primary-soft/40",
                  )}
                >
                  <span className="mb-0.5 flex items-center gap-2">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                    <span className="text-[12px] font-semibold text-ink">{n.title}</span>
                  </span>
                  <span className="block text-[11.5px] leading-4 text-muted">{n.detail}</span>
                  <span className="mt-1 block text-[10px] text-faint">{timeAgo(n.time)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User / workspace menu */}
      <div ref={userRef} className="relative">
        <button
          type="button"
          onClick={() => setUserOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-ink"
          aria-label="Workspace menu"
          aria-expanded={userOpen}
        >
          <CircleUser size={16} aria-hidden />
        </button>
        {userOpen && (
          <div className="anim-pop absolute right-0 top-full z-40 mt-1.5 w-64 rounded-md border border-line bg-surface py-1.5 shadow-pop">
            <div className="border-b border-line px-3 py-2">
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-[12px] font-semibold text-ink">{user?.fullName || "Infrastructure Planner"}</p>
                <span className={cx(
                  "rounded px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide",
                  user?.isDemo ? "bg-[#252830] text-muted border border-line" : "bg-primary-soft text-primary"
                )}>
                  {user?.isDemo ? "Demo" : "Active"}
                </span>
              </div>
              <p className="truncate text-[10.5px] text-muted">{user?.email}</p>
              <p className="truncate text-[10px] text-faint">{user?.organization} · {user?.role}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setUserOpen(false)}
              className="block px-3 py-2 text-[12px] text-ink-2 transition-colors hover:bg-app-bg hover:text-ink"
            >
              Workspace settings
            </Link>
            <Link
              href="/reports"
              onClick={() => setUserOpen(false)}
              className="block px-3 py-2 text-[12px] text-ink-2 transition-colors hover:bg-app-bg hover:text-ink"
            >
              Evidence & reports
            </Link>
            <div className="border-t border-line my-1" />
            <button
              type="button"
              onClick={async () => {
                setUserOpen(false);
                await signOut();
                router.push("/login");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-danger transition-colors hover:bg-app-bg"
            >
              <LogOut size={13} aria-hidden />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
