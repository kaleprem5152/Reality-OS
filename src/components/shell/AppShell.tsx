"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppProvider, useApp } from "@/components/providers/AppProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopNav } from "@/components/shell/TopNav";
import { CommandPalette } from "@/components/search/CommandPalette";
import { Database, RefreshCw } from "lucide-react";

function ShellBody({ children }: { children: ReactNode }) {
  const { loading, loadError, retryLoad, sidebarCollapsed } = useApp();
  const { user: authUser, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, authUser, router, pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-[12px] text-muted">Authenticating workspace…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <Database size={22} className="mx-auto text-faint" aria-hidden />
          <h1 className="mt-3 text-[15px] font-semibold text-ink">Workspace data unavailable</h1>
          <p className="mt-1 text-xs leading-5 text-muted">
            The project register could not be loaded. {loadError}
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={retryLoad}>
            <RefreshCw size={14} aria-hidden /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className="flex min-w-0 flex-1 flex-col transition-[margin] duration-150"
        style={{ marginLeft: sidebarCollapsed ? 64 : 232 }}
      >
        <TopNav />
        <main key={pathname} className="anim-fade flex-1 px-6 py-6">
          {loading ? (
            <div className="grid gap-4">
              <div className="skeleton h-8 w-72" />
              <div className="skeleton h-40 w-full" />
              <div className="skeleton h-64 w-full" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <ShellBody>{children}</ShellBody>
      <CommandPalette />
    </AppProvider>
  );
}
