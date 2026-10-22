"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSafeRedirectUrl } from "@/lib/redirect";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirectUrl(searchParams.get("redirect"), "/overview");
  const urlError = searchParams.get("error");
  const { signInWithGoogle, signInWithEmail, signInAsDemo, isConfigured } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle(redirect);
    if (res.error) {
      setError(res.error);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    const res = await signInWithEmail(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(redirect);
    }
  };

  const handleDemoAccess = () => {
    signInAsDemo();
    router.push(redirect);
  };

  return (
    <div className="rounded-xl border border-[#23262C] bg-[#0E1013] p-7 shadow-2xl">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#F2F3F5]">
          Sign in to RealityOS
        </h1>
        <p className="mt-1 text-[13px] text-[#8A909A]">
          Access your infrastructure workspaces, digital twins, and AI models.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-3 text-[12px] text-[#F87171]">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary: Google OAuth Sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[#2E333D] bg-[#14171C] py-2.5 text-[13px] font-medium text-[#F2F3F5] transition-colors hover:border-[#3E4552] hover:bg-[#1A1E24] disabled:opacity-50"
      >
        <GoogleIcon />
        <span>{googleLoading ? "Connecting to Google…" : "Continue with Google"}</span>
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#23262C]" />
        </div>
        <div className="relative flex justify-center text-[10.5px] uppercase tracking-wider text-[#626975]">
          <span className="bg-[#0E1013] px-2.5">or continue with work email</span>
        </div>
      </div>

      {/* Demo Credentials Helper Box */}
      <div className="mb-5 rounded-lg border border-[#7CD4AE]/30 bg-[#7CD4AE]/5 p-3.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-[#7CD4AE]">
            <KeyRound size={13} /> Demo Login Credentials
          </span>
          <button
            type="button"
            onClick={() => {
              setEmail("planner@realityos.internal");
              setPassword("realityos2026");
              setError(null);
            }}
            className="rounded bg-[#7CD4AE]/20 px-2 py-0.5 text-[10.5px] font-semibold text-[#7CD4AE] transition-colors hover:bg-[#7CD4AE]/30"
          >
            Auto-fill credentials
          </button>
        </div>
        <div className="mt-2.5 space-y-1 text-[12px] text-[#C4C9D0]">
          <div className="flex items-center justify-between">
            <span className="text-[#8A909A]">Email:</span>
            <code className="rounded border border-[#23262C] bg-[#0A0B0D] px-2 py-0.5 font-mono text-[11.5px] text-[#F2F3F5]">
              planner@realityos.internal
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#8A909A]">Password:</span>
            <code className="rounded border border-[#23262C] bg-[#0A0B0D] px-2 py-0.5 font-mono text-[11.5px] text-[#F2F3F5]">
              realityos2026
            </code>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-[#C4C9D0]" htmlFor="email">
            Work Email
          </label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="planner@authority.gov"
              required
              className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <label className="font-medium text-[#C4C9D0]" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[#8A909A] transition-colors hover:text-[#F2F3F5]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-10 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#626975] transition-colors hover:text-[#C4C9D0] focus:outline-none"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:opacity-50"
        >
          {loading ? "Authenticating…" : "Sign In with Credentials"}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </button>

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#23262C]" />
          </div>
          <div className="relative flex justify-center text-[10.5px] uppercase tracking-wider text-[#626975]">
            <span className="bg-[#0E1013] px-2">or instant bypass</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDemoAccess}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#23262C] bg-[#14171C] py-2 text-[12px] font-medium text-[#C4C9D0] transition-colors hover:border-[#353945] hover:text-white"
        >
          <Sparkles size={13} className="text-[#7CD4AE]" />
          Continue as Lead Planner (1-Click Demo)
        </button>
      </form>

      <div className="mt-6 border-t border-[#23262C] pt-4 text-center text-[12px] text-[#8A909A]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-[#7CD4AE] transition-colors hover:underline">
          Create an account
        </Link>
      </div>

      {!isConfigured && (
        <div className="mt-4 rounded-md border border-[#23262C] bg-[#0A0B0D] px-3 py-2 text-center text-[10.5px] text-[#626975]">
          Supabase credentials not configured in environment. The platform is running with instant local demo authentication.
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-[#8A909A]">Loading authentication…</div>}>
      <LoginForm />
    </Suspense>
  );
}
