import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient, isSupabaseConfigured } from "./supabase/client";

export { isSupabaseConfigured };

export function getSupabase(): SupabaseClient | null {
  return createBrowserClient();
}
