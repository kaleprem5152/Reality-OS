"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  ChevronDown,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Tooltip } from "@/components/ui";
import { cx } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/studio", label: "AI Planning Studio", icon: BrainCircuit },
  { href: "/geo", label: "Geo Intelligence", icon: MapIcon },
  { href: "/twin", label: "Digital Twin", icon: GitCompareArrows },
  { href: "/graph", label: "Knowledge Graph", icon: Network },
  { href: "/reports", label: "Reports & Evidence", icon: FileText },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="2.4" fill="#F2F3F5" />
      <circle cx="17" cy="6" r="2.4" fill="#9AA1AC" />
      <circle cx="11" cy="17" r="2.4" fill="#F2F3F5" />
      <path d="M6.8 6.3 15 6M5.9 7.1l4 8M16 8.2l-3.8 7" stroke="#F2F3F5" strokeWidth="1.3" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useApp();
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wsRef.current?.contains(e.target as Node)) setWsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [wsOpen]);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-sidebar-bg transition-[width] duration-150"
      style={{ width: sidebarCollapsed ? 64 : 232 }}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-line px-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface">
          <LogoMark />
        </span>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-ink">RealityOS</p>
            <p className="truncate text-[10px] leading-tight text-muted">Infrastructure intelligence</p>
          </div>
        )}
      </div>

      {/* Workspace selector (single demo workspace) */}
      <div ref={wsRef} className="relative px-2.5 pb-1 pt-3">
        <button
          type="button"
          onClick={() => setWsOpen((v) => !v)}
          className={cx(
            "flex w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface",
            sidebarCollapsed && "justify-center px-0",
          )}
          aria-expanded={wsOpen}
          aria-label="Workspace selector"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary-soft text-[10px] font-bold text-primary">
            MD
          </span>
          {!sidebarCollapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-ink">Metro Development Authority</span>
                <span className="block text-[9.5px] text-muted">Demo workspace</span>
              </span>
              <ChevronDown size={13} className={cx("shrink-0 text-faint transition-transform", wsOpen && "rotate-180")} aria-hidden />
            </>
          )}
        </button>
        {wsOpen && (
          <div className="anim-pop absolute left-2.5 right-2.5 top-full z-40 mt-1 rounded-md border border-line bg-surface p-1.5 shadow-pop">
            <div className="flex items-center justify-between rounded px-2 py-1.5 text-[11.5px] font-medium text-ink">
              Metro Development Authority
              <span className="text-[10px] font-semibold text-success">Active</span>
            </div>
            <p className="px-2 pb-1.5 pt-0.5 text-[10.5px] leading-4 text-muted">
              Prototype build ships with a single workspace. Multi-tenancy is out of scope.
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2.5" aria-label="Application sections">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const item = (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={sidebarCollapsed ? label : undefined}
              className={cx(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[12.5px] font-medium transition-colors",
                active ? "bg-surface text-primary shadow-card" : "text-ink-2 hover:bg-surface/70 hover:text-ink",
                sidebarCollapsed && "justify-center px-0",
              )}
            >
              <span
                className={cx(
                  "absolute left-0 top-1/2 h-[18px] w-[2.5px] -translate-y-1/2 rounded-r bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <Icon size={15.5} className={cx("shrink-0", active ? "text-primary" : "text-muted")} aria-hidden />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </Link>
          );
          return sidebarCollapsed ? (
            <Tooltip key={href} label={label}>
              {item}
            </Tooltip>
          ) : (
            item
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-line p-2.5">
        {!sidebarCollapsed && (
          <div className="mb-2 rounded-md border border-line bg-surface px-2.5 py-2 text-[10px] leading-4 text-muted">
            <span className="mb-0.5 block font-semibold text-ink-2">Prototype build 0.9</span>
            Deterministic demo dataset · no live government data
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className={cx(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-[7px] text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-ink",
            sidebarCollapsed && "justify-center px-0",
          )}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} aria-hidden /> : <PanelLeftClose size={15} aria-hidden />}
          {!sidebarCollapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
