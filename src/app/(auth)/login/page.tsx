"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, Lock, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/overview";
  const { signInWithEmail, signInAsDemo, isConfigured } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {/* Demo Fast Access Button */}
      <div className="mb-6 rounded-lg border border-[#23262C] bg-[#14171C] p-3.5">
        <div className="flex items-center justify-between text-[11px] text-[#8A909A]">
          <span className="flex items-center gap-1.5 font-medium text-[#7CD4AE]">
            <Sparkles size={13} className="text-[#7CD4AE]" /> Instant Evaluation Access
          </span>
          <span className="rounded bg-[#23262C] px-1.5 py-0.5 text-[9.5px]">No key required</span>
        </div>
        <button
          type="button"
          onClick={handleDemoAccess}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-[#23262C] py-2 text-[12.5px] font-medium text-[#F2F3F5] transition-all hover:bg-[#2C3038] hover:text-white"
        >
          <KeyRound size={13} />
          Continue as Lead Planner (Demo Profile)
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#23262C]" />
        </div>
        <div className="relative flex justify-center text-[10.5px] uppercase tracking-wider text-[#626975]">
          <span className="bg-[#0E1013] px-2">or authenticate with credentials</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-3 text-[12px] text-[#F87171]">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:opacity-50"
        >
          {loading ? "Authenticating…" : "Sign In"}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
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
