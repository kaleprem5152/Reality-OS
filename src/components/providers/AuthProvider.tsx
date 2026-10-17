"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_DEMO_CREDENTIALS,
  DEMO_USER,
  formatSupabaseUser,
  getStoredDemoUser,
  setStoredDemoUser,
  type AuthProfile,
} from "@/lib/authStore";

interface AuthContextType {
  user: AuthProfile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    meta: { fullName: string; organization?: string; role?: string }
  ) => Promise<{ error?: string; needVerification?: boolean }>;
  signInAsDemo: (customProfile?: Partial<AuthProfile>) => void;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      // Supabase is not configured — only restore user if previously authenticated
      const storedDemo = getStoredDemoUser();
      setUser(storedDemo || null);
      setLoading(false);
      return;
    }

    // Supabase is configured
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(formatSupabaseUser(session.user));
      } else {
        const storedDemo = getStoredDemoUser();
        if (storedDemo) {
          setUser(storedDemo);
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session);
        setUser(formatSupabaseUser(session.user));
        setStoredDemoUser(null);
      } else {
        setSession(null);
        const storedDemo = getStoredDemoUser();
        setUser(storedDemo || null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      const supabase = getSupabase();
      if (!supabase) {
        const cleanEmail = email.trim().toLowerCase();
        const isDefaultMatch =
          cleanEmail === DEFAULT_DEMO_CREDENTIALS.email.toLowerCase() &&
          password === DEFAULT_DEMO_CREDENTIALS.password;
        const isValidCustom = cleanEmail.includes("@") && password.length >= 6;

        if (isDefaultMatch || isValidCustom) {
          const profile: AuthProfile = {
            id: "planner-demo-01",
            email: cleanEmail,
            fullName:
              cleanEmail === DEFAULT_DEMO_CREDENTIALS.email.toLowerCase()
                ? "Lead Infrastructure Planner"
                : cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            organization: "Metropolitan Development Authority",
            role: "Lead Infrastructure Planner",
            isDemo: true,
          };
          setUser(profile);
          setStoredDemoUser(profile);
          return {};
        }

        return {
          error: `Invalid credentials. Please use "${DEFAULT_DEMO_CREDENTIALS.email}" with password "${DEFAULT_DEMO_CREDENTIALS.password}", or click 'Auto-fill'.`,
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(formatSupabaseUser(data.user));
        setStoredDemoUser(null);
      }
      return {};
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      meta: { fullName: string; organization?: string; role?: string }
    ): Promise<{ error?: string; needVerification?: boolean }> => {
      const supabase = getSupabase();
      if (!supabase) {
        // In demo mode, sign up simulates immediate success
        const profile: AuthProfile = {
          id: `usr-${Date.now()}`,
          email,
          fullName: meta.fullName || email.split("@")[0],
          organization: meta.organization || "Metropolitan Authority",
          role: meta.role || "Lead Infrastructure Planner",
          isDemo: true,
        };
        setUser(profile);
        setStoredDemoUser(profile);
        return {};
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: meta.fullName,
            organization: meta.organization,
            role: meta.role,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session?.user) {
        setUser(formatSupabaseUser(data.session.user));
        setStoredDemoUser(null);
        return {};
      }

      return { needVerification: true };
    },
    []
  );

  const signInAsDemo = useCallback((customProfile?: Partial<AuthProfile>) => {
    const profile: AuthProfile = {
      ...DEMO_USER,
      ...customProfile,
      isDemo: true,
    };
    setUser(profile);
    setStoredDemoUser(profile);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setStoredDemoUser(null);
    setUser(null);
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error?: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      // In demo mode, simulate success
      return {};
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) {
      return { error: error.message };
    }
    return {};
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error?: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return {};
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      return { error: error.message };
    }
    return {};
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: configured,
        signInWithEmail,
        signUpWithEmail,
        signInAsDemo,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
