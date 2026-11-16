"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert, Sparkles, User } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  isValidEmail,
  validateFullName,
  validatePassword,
  MAX_FULL_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_ORGANIZATION_LENGTH,
} from "@/lib/validation";

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

function SignUpForm() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("Lead Infrastructure Planner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isBusy = loading || googleLoading;

  const handleGoogleSignUp = async () => {
    if (isBusy) return;
    setError(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle("/onboarding");
    if (res.error) {
      setError(res.error);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setError(null);
    setSuccess(null);

    // 1. Full Name validation (1 - 50 characters, non-whitespace)
    const nameValidation = validateFullName(fullName);
    if (!nameValidation.valid) {
      setError(nameValidation.error || "Full Name is required and cannot be empty.");
      return;
    }

    // 2. Email format validation (rejects invalid patterns like harsh099@2026)
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Work Email is required.");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid work email address with a domain extension (e.g., name@organization.gov).");
      return;
    }

    // 3. Password length validation (6 - 50 characters, preserves characters)
    const passValidation = validatePassword(password);
    if (!passValidation.valid) {
      setError(passValidation.error || "Password must be between 6 and 50 characters.");
      return;
    }

    setLoading(true);
    const res = await signUpWithEmail(cleanEmail, password, {
      fullName: fullName.trim(),
      organization: organization.trim() || "Metropolitan Authority",
      role,
    });
    setLoading(false);

    if (res.error) {
      // Preserve form values so user does not have to retype them
      setError(res.error);
    } else if (res.needVerification) {
      setSuccess(`Account registered for ${cleanEmail}! Please check your email for the verification link to activate your workspace.`);
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

          {/* Primary: Google OAuth Sign-up */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[#2E333D] bg-[#14171C] py-2.5 text-[13px] font-medium text-[#F2F3F5] transition-colors hover:border-[#3E4552] hover:bg-[#1A1E24] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleIcon />
            <span>{googleLoading ? "Connecting to Google…" : "Sign up with Google"}</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#23262C]" />
            </div>
            <div className="relative flex justify-center text-[10.5px] uppercase tracking-wider text-[#626975]">
              <span className="bg-[#0E1013] px-2.5">or register with work email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <label className="font-medium text-[#C4C9D0]" htmlFor="fullName">
                  Full Name *
                </label>
                <span className="text-[10px] text-[#626975]">{fullName.length}/{MAX_FULL_NAME_LENGTH}</span>
              </div>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Rostova"
                  maxLength={MAX_FULL_NAME_LENGTH}
                  disabled={isBusy}
                  required
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <label className="font-medium text-[#C4C9D0]" htmlFor="org">
                  Organization / Authority
                </label>
                <span className="text-[10px] text-[#626975]">{organization.length}/{MAX_ORGANIZATION_LENGTH}</span>
              </div>
              <div className="relative">
                <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
                <input
                  id="org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Metro Transit & Infrastructure Authority"
                  maxLength={MAX_ORGANIZATION_LENGTH}
                  disabled={isBusy}
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary disabled:opacity-50"
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
                disabled={isBusy}
                className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] px-3 py-2 text-[13px] text-[#F2F3F5] outline-none transition-colors focus:border-primary disabled:opacity-50"
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
                  maxLength={254}
                  disabled={isBusy}
                  required
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <label className="font-medium text-[#C4C9D0]" htmlFor="password">
                  Password * (6–50 characters)
                </label>
                <span className="text-[10px] text-[#626975]">{password.length}/{MAX_PASSWORD_LENGTH}</span>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626975]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  maxLength={MAX_PASSWORD_LENGTH}
                  disabled={isBusy}
                  required
                  className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 pl-9 pr-10 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isBusy}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#626975] transition-colors hover:text-[#C4C9D0] focus:outline-none disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-[#0A0B0D]" />
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <span>Register Workspace</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
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
