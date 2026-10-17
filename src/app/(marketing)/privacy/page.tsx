import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
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
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F2F3F5]">Privacy Policy</h1>
            <p className="text-xs text-[#8A909A]">Last updated: October 2026 · Version 2.1</p>
          </div>
        </div>

        <div className="space-y-8 text-[13.5px] leading-relaxed text-[#C4C9D0]">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">1. Overview & Infrastructure Scope</h2>
            <p>
              RealityOS (&quot;the Platform&quot;) provides cognitive infrastructure intelligence, digital twin simulations, and planning analysis for government transport authorities, civil engineering consultancies, and private operators. This Privacy Policy details how we handle account credentials, workspace telemetry, and infrastructure dataset confidentiality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">2. Infrastructure Data Isolation & Confidentiality</h2>
            <p>
              Planning briefs, cost models, geospatial alignment shapefiles, utility clash logs, and environmental reviews ingested into customer-dedicated workspaces are segregated using Row-Level Security (RLS) policies and encrypted at rest (AES-256) and in transit (TLS 1.3).
            </p>
            <p>
              Customer project data submitted to the AI Planning Studio is processed statelessly on the server without being used to train foundation models.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">3. Authentication & Account Credentials</h2>
            <p>
              User authentication is mediated via Supabase Authentication with salted hashes (bcrypt) and JWT session tokens. Users operating in local Evaluation/Demo mode store session data strictly within browser local storage; no third-party identification is transmitted.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">4. Auditability & Evidence Integrity</h2>
            <p>
              Generated planning reports, scenario simulation runs, and Monte Carlo trade-off packages incorporate immutable timestamps and model version provenance to ensure auditability during public inquiry and capital committee review.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#F2F3F5]">5. Contact Information</h2>
            <p>
              For privacy audits, SOC 2 compliance verification, or data residency inquiries, contact the RealityOS Security Office at <span className="text-primary">security@realityos.internal</span>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
