import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export interface AuthProfile {
  id: string;
  email: string;
  fullName: string;
  organization: string;
  role: string;
  isDemo: boolean;
}

export const DEFAULT_DEMO_CREDENTIALS = {
  email: "planner@realityos.internal",
  password: "realityos2026",
};

export const DEMO_USER: AuthProfile = {
  id: "demo-planner-01",
  email: "planner@realityos.internal",
  fullName: "Lead Infrastructure Planner",
  organization: "Metropolitan Development Authority",
  role: "Lead Infrastructure Planner",
  isDemo: true,
};

const DEMO_STORAGE_KEY = "realityos_demo_auth_profile";
const DEMO_COOKIE_NAME = "realityos_demo_session";

export function getStoredDemoUser(): AuthProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredDemoUser(user: AuthProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
      document.cookie = `${DEMO_COOKIE_NAME}=1; path=/; max-age=604800; SameSite=Lax`;
    } else {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

export function formatSupabaseUser(user: SupabaseUser): AuthProfile {
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || "user@realityos.internal",
    fullName: meta.full_name || meta.fullName || user.email?.split("@")[0] || "Infrastructure Planner",
    organization: meta.organization || "Infrastructure Authority",
    role: meta.role || "Planner",
    isDemo: false,
  };
}
