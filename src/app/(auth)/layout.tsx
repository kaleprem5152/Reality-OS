import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#0A0B0D] text-[#F2F3F5] selection:bg-primary selection:text-[#0A0B0D]">
      {/* Background ambient gradient */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-[25%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-[140px]" />
        <div className="absolute top-[40%] right-[10%] h-[400px] w-[500px] rounded-full bg-[#3B82F6]/5 blur-[120px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 flex h-16 items-center justify-between border-b border-[#23262C] px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <circle cx="5" cy="5" r="2.4" fill="#F2F3F5" />
            <circle cx="17" cy="6" r="2.4" fill="#7CD4AE" />
            <circle cx="11" cy="17" r="2.4" fill="#F2F3F5" />
            <path d="M6.8 6.3 15 6M5.9 7.1l4 8M16 8.2l-3.8 7" stroke="#F2F3F5" strokeWidth="1.3" />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight text-[#F2F3F5]">RealityOS</span>
        </Link>
        <div className="flex items-center gap-4 text-xs text-[#8A909A]">
          <Link href="/" className="transition-colors hover:text-[#F2F3F5]">
            Back to marketing
          </Link>
          <span className="text-[#353945]">/</span>
          <span className="text-[#626975]">
            Authentication Gateway
          </span>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 border-t border-[#23262C] px-6 py-4">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 text-[11px] text-[#626975]">
          <p>© {new Date().getFullYear()} RealityOS Infrastructure Intelligence Platform.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-[#8A909A]">Privacy Policy</Link>
            <Link href="/terms" className="transition-colors hover:text-[#8A909A]">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
