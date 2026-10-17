"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CornerDownLeft,
  FilePlus2,
  FolderKanban,
  GitCompareArrows,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  PanelLeft,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { cx } from "@/lib/format";
import type { Project } from "@/lib/types";

interface ResultItem {
  id: string;
  group: "Projects" | "Pages" | "Actions";
  label: string;
  sub?: string;
  icon: LucideIcon;
  run: () => void;
  keywords: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, projects, toggleSidebar, requestStudioRun } = useApp();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setPaletteOpen(false);
    setQuery("");
    setIndex(0);
  }, [setPaletteOpen]);

  const items: ResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    const projectItems: ResultItem[] = projects.map((p: Project) => ({
      id: `proj-${p.id}`,
      group: "Projects",
      label: p.name,
      sub: `${p.id} · ${p.infraType} · ${p.region}${p.archived ? " · archived" : ""}`,
      icon: FolderKanban,
      run: () => router.push(`/projects/${p.id}`),
      keywords: `${p.name} ${p.id} ${p.region} ${p.infraType}`.toLowerCase(),
    }));

    const pageItems: ResultItem[] = [
      { id: "page-overview", group: "Pages", label: "Overview — Command Center", sub: "Executive portfolio view", icon: LayoutDashboard, run: () => router.push("/overview"), keywords: "overview command center home dashboard portfolio" },
      { id: "page-projects", group: "Pages", label: "Projects", sub: "Project register", icon: FolderKanban, run: () => router.push("/projects"), keywords: "projects register list" },
      { id: "page-studio", group: "Pages", label: "AI Planning Studio", sub: "Structured planning analysis", icon: Sparkles, run: () => router.push("/studio"), keywords: "ai planning studio analysis agents" },
      { id: "page-geo", group: "Pages", label: "Geo Intelligence", sub: "Map, candidates, suitability", icon: MapIcon, run: () => router.push("/geo"), keywords: "geo map gis stations corridors suitability" },
      { id: "page-twin", group: "Pages", label: "Digital Twin", sub: "Scenario simulation", icon: GitCompareArrows, run: () => router.push("/twin"), keywords: "digital twin simulation scenarios monte carlo" },
      { id: "page-graph", group: "Pages", label: "Knowledge Graph", sub: "Entity relationships", icon: Network, run: () => router.push("/graph"), keywords: "knowledge graph dependencies risks" },
      { id: "page-reports", group: "Pages", label: "Reports & Evidence", sub: "Register and PDF export", icon: FilePlus2, run: () => router.push("/reports"), keywords: "reports evidence pdf export" },
      { id: "page-settings", group: "Pages", label: "Settings", sub: "Workspace preferences", icon: PanelLeft, run: () => router.push("/settings"), keywords: "settings preferences currency defaults" },
    ];

    const actionItems: ResultItem[] = [
      { id: "act-new", group: "Actions", label: "New project", sub: "Open the 3-step creation wizard", icon: FilePlus2, run: () => router.push("/projects?new=1"), keywords: "create new project add wizard" },
      { id: "act-sim", group: "Actions", label: "Run simulation", sub: "Open Digital Twin scenario workspace", icon: GitCompareArrows, run: () => router.push("/twin"), keywords: "run simulation scenario twin" },
      {
        id: "act-analyze", group: "Actions", label: "Run planning analysis", sub: "Send current project to AI Planning Studio", icon: Sparkles,
        run: () => {
          const featured = projects.find((p) => p.featured && !p.archived) ?? projects[0];
          if (featured) {
            requestStudioRun({ projectId: featured.id, requirements: featured.requirements, objectives: [] });
          }
          router.push("/studio");
        },
        keywords: "run analysis planning ai studio",
      },
      { id: "act-report", group: "Actions", label: "Generate report", sub: "Open Reports with generation dialog", icon: FilePlus2, run: () => router.push("/reports?generate=1"), keywords: "generate report new export" },
      { id: "act-sidebar", group: "Actions", label: "Toggle sidebar", sub: "Collapse or expand the navigation", icon: PanelLeft, run: () => toggleSidebar(), keywords: "toggle sidebar collapse expand" },
    ];

    const all = [...projectItems, ...pageItems, ...actionItems];
    if (!q) return all;
    return all.filter((it) => it.keywords.includes(q));
  }, [query, projects, router, toggleSidebar, requestStudioRun]);

  // clamp selection when results change
  useEffect(() => {
    setIndex(0);
  }, [query]);

  // focus + restore management
  useEffect(() => {
    if (!paletteOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [paletteOpen]);

  // keep selected item visible
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[index];
      if (it) {
        close();
        it.run();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!paletteOpen) return null;

  const groups: { name: string; slice: ResultItem[]; startIdx: number }[] = [];
  let cursor = 0;
  for (const g of ["Projects", "Pages", "Actions"] as const) {
    const slice = items.filter((i) => i.group === g);
    if (slice.length) {
      groups.push({ name: g, slice, startIdx: cursor });
    }
    cursor += slice.length;
  }
  const flat: ResultItem[] = groups.flatMap((g) => g.slice);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(0,0,0,0.55)] p-4 pt-[10vh] anim-fade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div className="anim-pop w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={15} className="shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, pages, and actions…"
            className="h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={flat[index] ? `opt-${flat[index].id}` : undefined}
            aria-label="Search"
          />
          <kbd className="rounded border border-line bg-app-bg px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[380px] overflow-y-auto p-2">
          {flat.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] font-medium text-ink">No results for “{query}”</p>
              <p className="mt-1 text-[11.5px] text-muted">Try a project name (Metro Intelligence), an ID (PRJ-1001), a region, or a page.</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.name}>
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">{g.name}</p>
              {g.slice.map((it, i) => {
                const globalIdx = g.startIdx + i;
                const active = globalIdx === index;
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    id={`opt-${it.id}`}
                    data-idx={globalIdx}
                    role="option"
                    aria-selected={active}
                    type="button"
                    onMouseEnter={() => setIndex(globalIdx)}
                    onClick={() => {
                      close();
                      it.run();
                    }}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors",
                      active ? "bg-primary-soft" : "hover:bg-app-bg",
                    )}
                  >
                    <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded border", active ? "border-[#3A404B] bg-surface text-primary" : "border-line bg-app-bg text-muted")}>
                      <Icon size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink">{it.label}</span>
                      {it.sub && <span className="block truncate text-[11px] text-muted">{it.sub}</span>}
                    </span>
                    {active && <CornerDownLeft size={13} className="shrink-0 text-primary" aria-hidden />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-app-bg px-4 py-2 text-[10.5px] text-muted">
          <span className="flex items-center gap-1"><ArrowRight size={11} className="rotate-90" aria-hidden />↑↓ navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={11} aria-hidden />select</span>
          <span className="ml-auto">Ctrl/⌘ + K toggles</span>
        </div>
      </div>
    </div>
  );
}
