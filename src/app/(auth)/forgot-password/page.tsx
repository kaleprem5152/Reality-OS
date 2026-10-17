"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError("Please enter your work email.");
      return;
    }
    setLoading(true);
    const res = await resetPassword(email);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSubmitted(true);
    }
  };

  return (
    <div className="rounded-xl border border-[#23262C] bg-[#0E1013] p-7 shadow-2xl">
      <Link
        href="/login"
        className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-[#8A909A] transition-colors hover:text-[#F2F3F5]"
      >
        <ArrowLeft size={13} /> Back to Sign In
      </Link>

      <div className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#F2F3F5]">
          Reset your password
        </h1>
        <p className="mt-1 text-[13px] text-[#8A909A]">
          Enter your registered work email and we will send instructions to reset your password.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-lg border border-[#7CD4AE]/30 bg-[#7CD4AE]/10 p-5 text-center">
          <CheckCircle2 size={32} className="mx-auto text-[#7CD4AE]" />
          <h2 className="mt-3 text-[15px] font-semibold text-[#F2F3F5]">Reset Link Dispatched</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8A909A]">
            If an account exists for <span className="text-[#F2F3F5]">{email}</span>, you will receive password recovery instructions shortly.
          </p>
          <div className="mt-5">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#23262C] px-4 py-2 text-[12px] font-semibold text-[#F2F3F5] transition-colors hover:bg-[#2C3038]"
            >
              Return to Login
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#C4C9D0]" htmlFor="email">
                Work Email Address
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

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:opacity-50"
            >
              {loading ? "Sending reset link…" : "Send Reset Link"}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
