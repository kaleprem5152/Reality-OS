"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building, CheckCircle2, Lock, Mail, ShieldAlert, Sparkles, User } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

function SignUpForm() {
  const router = useRouter();
  const { signUpWithEmail, signInAsDemo } = useAuth();

  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("Lead Infrastructure Planner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!fullName || !email || !password) {
      setError("Please fill out all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const res = await signUpWithEmail(email, password, {
      fullName,
      organization: organization || "Metropolitan Authority",
      role,
    });
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.needVerification) {
      setSuccess("Account created! Please check your email for a verification link.");
    } else {
      router.push("/onboarding");
    }
  };

  return (
    <div className="rounded-xl border border-[#23262C] bg-[#0E1013] p-7 shadow-2xl">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#F2F3F5]">
          Create RealityOS Account
        </h1>
        <p className="mt-1 text-[13px] text-[#8A909A]">
          Join your organization&apos;s infrastructure intelligence workspace.
        </p>
      </div>

      {success ? (
        <div className="rounded-lg border border-[#7CD4AE]/30 bg-[#7CD4AE]/10 p-5 text-center">
          <CheckCircle2 size={32} className="mx-auto text-[#7CD4AE]" />
          <h2 className="mt-3 text-[15px] font-semibold text-[#F2F3F5]">Verification Email Sent</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8A909A]">{success}</p>
          <div className="mt-5">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#23262C] px-4 py-2 text-[12px] font-semibold text-[#F2F3F5] transition-colors hover:bg-[#2C3038]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-3 text-[12px] text-[#F87171]">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-[#C4C9D0]" htmlFor="fullName">
                Full Name *
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Rostova"
                  required
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-[#C4C9D0]" htmlFor="org">
                Organization / Authority
              </label>
              <div className="relative">
                <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
                <input
                  id="org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Metro Transit & Infrastructure Authority"
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-[#C4C9D0]" htmlFor="role">
                Planning Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] px-3 py-2 text-[13px] text-[#F2F3F5] outline-none transition-colors focus:border-primary"
              >
                <option value="Lead Infrastructure Planner">Lead Infrastructure Planner</option>
                <option value="Transportation Engineer">Transportation Engineer</option>
                <option value="Financial & Cost Analyst">Financial & Cost Analyst</option>
                <option value="Environmental Impact Specialist">Environmental Impact Specialist</option>
                <option value="Executive Director / Commissioner">Executive Director / Commissioner</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-[#C4C9D0]" htmlFor="email">
                Work Email *
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.rostova@transit-authority.gov"
                  required
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-[#C4C9D0]" htmlFor="password">
                Password * (min 6 characters)
              </label>
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
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Register Workspace"}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#8A909A] transition-colors hover:text-[#7CD4AE]"
            >
              <Sparkles size={13} /> Or sign in with Demo Credentials
            </Link>
          </div>

          <div className="mt-5 border-t border-[#23262C] pt-4 text-center text-[12px] text-[#8A909A]">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#7CD4AE] transition-colors hover:underline">
              Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-[#8A909A]">Loading…</div>}>
      <SignUpForm />
    </Suspense>
  );
}
