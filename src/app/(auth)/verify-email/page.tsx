import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <div className="rounded-xl border border-[#23262C] bg-[#0E1013] p-7 text-center shadow-2xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#7CD4AE]/30 bg-[#7CD4AE]/10">
        <MailCheck size={28} className="text-[#7CD4AE]" />
      </div>

      <h1 className="mt-5 text-[20px] font-semibold tracking-tight text-[#F2F3F5]">
        Verify your email address
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#8A909A]">
        We sent an authorization link to your work email. Click the link inside to activate your infrastructure intelligence workspace.
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-[#F2F3F5] px-4 py-2 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0]"
        >
          Proceed to Sign In
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md border border-[#23262C] bg-[#14171C] px-4 py-2 text-[12px] font-medium text-[#8A909A] transition-colors hover:bg-[#23262C] hover:text-[#F2F3F5]"
        >
          Use Demo Credentials on Login
        </Link>
      </div>
    </div>
  );
}
