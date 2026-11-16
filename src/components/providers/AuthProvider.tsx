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
import { getSafeRedirectUrl } from "@/lib/redirect";
import {
  isValidEmail,
  validateFullName,
  validatePassword,
} from "@/lib/validation";

interface AuthContextType {
  user: AuthProfile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: (customRedirect?: string) => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    meta: { fullName: string; organization?: string; role?: string }
  ) => Promise<{ error?: string; needVerification?: boolean }>;
  signInAsDemo: (customProfile?: Partial<AuthProfile>) => Promise<{ error?: string }>;
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
  const [user, setUser] = useState<AuthProfile | null>(() => getStoredDemoUser());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    const verifyServerDemo = async (): Promise<boolean> => {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && mounted) {
            setUser(data.user);
            setStoredDemoUser(data.user);
            setLoading(false);
            return true;
          }
        }
      } catch {
        // Network or offline
      }
      return false;
    };

    if (!supabase) {
      // Supabase is not configured — verify server demo
      verifyServerDemo().then((verified) => {
        if (!mounted) return;
        if (!verified) {
          setStoredDemoUser(null);
          setUser(null);
        }
        setLoading(false);
      });
      return;
    }

    // Supabase is configured
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setSession(session);
        setUser(formatSupabaseUser(session.user));
        setLoading(false);
      } else {
        // Check for verified server demo session
        const verified = await verifyServerDemo();
        if (!mounted) return;
        if (!verified) {
          setStoredDemoUser(null);
          setUser(null);
        }
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setSession(session);
        setUser(formatSupabaseUser(session.user));
        setStoredDemoUser(null);
        setLoading(false);
      } else {
        setSession(null);
        verifyServerDemo().then((verified) => {
          if (!mounted) return;
          if (!verified) {
            setStoredDemoUser(null);
            setUser(null);
          }
          setLoading(false);
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(
    async (customRedirect?: string): Promise<{ error?: string }> => {
      const supabase = getSupabase();
      if (!supabase) {
        return {
          error: "Supabase authentication is not configured. Please use Demo Login credentials.",
        };
      }

      const redirectPath = getSafeRedirectUrl(customRedirect, "/overview");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectUrl = `${origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        return { error: error.message };
      }
      return {};
    },
    []
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        return { error: "Please enter your work email." };
      }
      if (!isValidEmail(cleanEmail)) {
        return { error: "Please enter a valid email address with a domain extension (e.g. name@organization.gov)." };
      }
      if (!password) {
        return { error: "Please enter your password." };
      }

      const isDefaultMatch =
        cleanEmail === DEFAULT_DEMO_CREDENTIALS.email.toLowerCase() &&
        password === DEFAULT_DEMO_CREDENTIALS.password;

      // Handle demo credentials via server validation endpoint
      if (isDefaultMatch) {
        try {
          const res = await fetch("/api/auth/demo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: cleanEmail, password }),
          });
          const data = await res.json();
          if (res.ok && data.user) {
            setUser(data.user);
            setStoredDemoUser(data.user);
            return {};
          }
          return { error: data.error || "Demo authentication failed." };
        } catch {
          return { error: "Failed to connect to authentication service." };
        }
      }

      const supabase = getSupabase();
      if (!supabase) {
        const isValidCustom = cleanEmail.includes("@") && password.length >= 6;
        if (isValidCustom) {
          const profile: AuthProfile = {
            id: "planner-demo-01",
            email: cleanEmail,
            fullName: cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = error.message || "";
        const lower = msg.toLowerCase();
        if (lower.includes("rate limit") || (error as { status?: number }).status === 429) {
          return {
            error: "Too many sign-in attempts. Please wait a few minutes before trying again, or use demo login.",
          };
        }
        if (lower.includes("invalid login credentials")) {
          return {
            error: "Invalid email or password. Please check your credentials or use the Lead Planner demo login.",
          };
        }
        if (lower.includes("email not confirmed")) {
          return {
            error: "Please verify your email address before signing in. Check your inbox for the confirmation link.",
          };
        }
        return { error: msg };
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
      const cleanEmail = email.trim().toLowerCase();
      const nameValidation = validateFullName(meta.fullName);
      if (!nameValidation.valid) {
        return { error: nameValidation.error };
      }

      if (!isValidEmail(cleanEmail)) {
        return { error: "Please enter a valid work email address (e.g., name@organization.gov)." };
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return { error: passwordValidation.error };
      }

      const cleanOrg = meta.organization?.trim().slice(0, 100) || "Metropolitan Authority";
      const cleanRole = meta.role?.trim().slice(0, 50) || "Lead Infrastructure Planner";

      const supabase = getSupabase();
      if (!supabase) {
        // In demo mode, sign up simulates immediate success
        const profile: AuthProfile = {
          id: `usr-${Date.now()}`,
          email: cleanEmail,
          fullName: meta.fullName.trim(),
          organization: cleanOrg,
          role: cleanRole,
          isDemo: true,
        };
        setUser(profile);
        setStoredDemoUser(profile);
        return {};
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const emailRedirectTo = origin ? `${origin}/auth/callback?next=/onboarding` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: meta.fullName.trim(),
            organization: cleanOrg,
            role: cleanRole,
          },
          emailRedirectTo,
        },
      });

      if (error) {
        const msg = error.message || "";
        const lower = msg.toLowerCase();
        if (lower.includes("rate limit") || (error as { status?: number }).status === 429) {
          return {
            error: "Email rate limit reached. Supabase has temporarily restricted outgoing emails to prevent abuse. Please wait 15–30 minutes before trying again, or use demo login to explore immediately.",
          };
        }
        if (lower.includes("already registered") || lower.includes("user already exists")) {
          return {
            error: "An account with this email already exists. Please sign in or reset your password.",
          };
        }
        return { error: msg };
      }

      // Supabase v2 returns an empty identities array if user already exists
      if (data.user?.identities && data.user.identities.length === 0) {
        return {
          error: "An account with this email already exists. Please sign in or reset your password.",
        };
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

  const signInAsDemo = useCallback(async (customProfile?: Partial<AuthProfile>): Promise<{ error?: string }> => {
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is1Click: true, ...customProfile }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setStoredDemoUser(data.user);
        return {};
      }
      return { error: data.error || "Demo authentication is currently unavailable." };
    } catch {
      return { error: "Failed to connect to demo authentication service." };
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    await fetch("/api/auth/demo", { method: "DELETE" }).catch(() => {});
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
        signInWithGoogle,
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
