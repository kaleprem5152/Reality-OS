import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#F2F3F5] selection:bg-primary selection:text-[#0A0B0D]">
      <header className="border-b border-[#23262C] bg-[#0D0F11]">
        <div className="mx-auto flex h-16 max-w-[900px] items-center justify-between px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8A909A] hover:text-[#F2F3F5]">
            <ArrowLeft size={14} /> Back to RealityOS
          </Link>
          <span className="text-xs text-[#626975]">Legal Documentation</span>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <FileText size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F2F3F5]">Terms of Service</h1>
            <p className="text-xs text-[#8A909A]">Effective date: October 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-[13.5px] leading-relaxed text-[#C4C9D0]">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">1. Acceptance of Terms</h2>
            <p>
              By accessing RealityOS, deploying planning agent workspaces, or generating infrastructure simulation packages, you agree to comply with and be bound by these Terms of Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">2. Advisory Nature of AI Infrastructure Syntheses</h2>
            <p>
              RealityOS outputs—including agent analyses, capital cost estimations, corridor risk ratings, and Monte Carlo scenario runs—are algorithmic decision-support syntheses. They do not constitute certified statutory civil engineering, environmental impact statements, or legal land title guarantees without human expert review and formal sign-off.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">3. Multi-Tenant Tenancy & Access Controls</h2>
            <p>
              Users must preserve the confidentiality of their credentials. Administrative roles within authorities are responsible for user provisioning and project authorization levels.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">4. Intellectual Property & Export Rights</h2>
            <p>
              All customer data, ingested alignments, project requirements, and exported evidence PDFs remain the exclusive property of the subscribing organization or sponsoring authority.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
