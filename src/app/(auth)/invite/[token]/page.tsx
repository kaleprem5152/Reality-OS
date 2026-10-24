"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function InviteAcceptancePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const { user, isConfigured } = useAuth();

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);
  const [workspaceData, setWorkspaceData] = useState<{
    workspaceName?: string;
    role?: string;
    email?: string;
    expiresAt?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      try {
        setLoadingPreview(true);
        setPreviewError(null);
        const data = await api.getInvitationPreview(token);
        if (!active) return;

        if (data.valid) {
          setWorkspaceData({
            workspaceName: data.workspaceName,
            role: data.role,
            email: data.email,
            expiresAt: data.expiresAt,
          });
        } else {
          setPreviewError(data.error || "Invalid or expired invitation token.");
        }
      } catch (err) {
        if (!active) return;
        setPreviewError(
          err instanceof Error ? err.message : "Unable to retrieve invitation details.",
        );
      } finally {
        if (active) setLoadingPreview(false);
      }
    }

    if (token) {
      loadPreview();
    }

    return () => {
      active = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    setAcceptError(null);

    try {
      const res = await api.acceptInvitation(token);
      if (res.success) {
        setAcceptedSuccess(true);
        setTimeout(() => {
          router.push("/overview");
        }, 1500);
      } else {
        setAcceptError("Failed to accept invitation.");
        setAccepting(false);
      }
    } catch (err) {
      setAcceptError(
        err instanceof Error ? err.message : "An error occurred while accepting the invitation.",
      );
      setAccepting(false);
    }
  };

  const isEmailMismatch =
    user &&
    workspaceData?.email &&
    user.email.toLowerCase().trim() !== workspaceData.email.toLowerCase().trim();

  return (
    <div className="rounded-xl border border-[#23262C] bg-[#0E1013] p-7 shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <Shield size={12} /> Workspace Invitation
        </span>
        <h1 className="mt-3 text-[20px] font-semibold tracking-tight text-[#F2F3F5]">
          Join Infrastructure Authority
        </h1>
        <p className="mt-1 text-[13px] text-[#8A909A]">
          Review invitation details and accept authorization to collaborate.
        </p>
      </div>

      {/* Loading state */}
      {loadingPreview && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-[#8A909A]">
          <Loader2 size={24} className="animate-spin text-primary mb-3" />
          <p className="text-[13px]">Validating invitation credentials…</p>
        </div>
      )}

      {/* Invalid or Expired Invitation Error */}
      {!loadingPreview && previewError && (
        <div className="space-y-4">
          <div className="rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-4 text-[13px] text-[#F87171]">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-[#F87171]">Invitation Unavailable</p>
                <p className="mt-1 text-[12px] text-[#FCA5A5]">{previewError}</p>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#23262C] px-4 py-2 text-[12.5px] font-medium text-[#F2F3F5] transition-colors hover:bg-[#2C3038]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      )}

      {/* Valid Invitation Preview */}
      {!loadingPreview && !previewError && workspaceData && (
        <div className="space-y-5">
          {/* Workspace & Role Summary */}
          <div className="rounded-lg border border-[#23262C] bg-[#14171C] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#626975]">
              Target Workspace
            </p>
            <p className="mt-1 text-[15px] font-semibold text-[#F2F3F5]">
              {workspaceData.workspaceName || "Metropolitan Authority Workspace"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#23262C] pt-3 text-[12px]">
              <div>
                <span className="text-[#8A909A]">Assigned Role:</span>
                <span className="ml-2 inline-flex items-center rounded bg-primary/10 px-2 py-0.5 font-medium capitalize text-primary">
                  {workspaceData.role || "viewer"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[#8A909A]">
                <Clock size={13} className="shrink-0" />
                <span>Expires in 7 days</span>
              </div>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="rounded-md border border-[#23262C] bg-[#0A0B0D] p-3 text-[12px] text-[#8A909A] flex items-center gap-2.5">
            <Mail size={15} className="shrink-0 text-primary" />
            <span>
              Invited recipient: <strong className="text-[#F2F3F5]">{workspaceData.email}</strong>
            </span>
          </div>

          {/* Authentication State: User is NOT logged in */}
          {!user && (
            <div className="space-y-3 pt-2">
              <div className="rounded-md border border-[#353945] bg-[#14171C] p-3 text-[12px] text-[#C4C9D0]">
                <Lock size={14} className="inline mr-1.5 text-primary" />
                Authentication required: Sign in or create an account with{" "}
                <strong className="text-white">{workspaceData.email}</strong> to accept this invitation.
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0]"
                >
                  Sign In to Accept
                  <ArrowRight size={14} />
                </Link>

                <Link
                  href={`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-[#23262C] bg-[#14171C] py-2.5 text-[12.5px] font-medium text-[#C4C9D0] transition-colors hover:bg-[#1C2026] hover:text-white"
                >
                  Create New Account
                </Link>
              </div>
            </div>
          )}

          {/* Authentication State: User IS logged in, but email MISMATCH */}
          {user && isEmailMismatch && (
            <div className="space-y-4 pt-1">
              <div className="rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-3.5 text-[12px] text-[#F87171]">
                <div className="flex items-start gap-2">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Email Mismatch</p>
                    <p className="mt-1 leading-relaxed text-[#FCA5A5]">
                      You are signed in as <strong className="text-white">{user.email}</strong>, but this
                      invitation was sent to <strong className="text-white">{workspaceData.email}</strong>.
                      Please sign in with the invited email address to accept.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-[#23262C] bg-[#14171C] py-2 text-[12.5px] font-medium text-[#C4C9D0] transition-colors hover:bg-[#1C2026] hover:text-white"
              >
                Sign In With Another Account
              </Link>
            </div>
          )}

          {/* Authentication State: User IS logged in AND emails MATCH */}
          {user && !isEmailMismatch && !acceptedSuccess && (
            <div className="space-y-4 pt-1">
              {acceptError && (
                <div className="flex items-start gap-2 rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-3 text-[12px] text-[#F87171]">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <span>{acceptError}</span>
                </div>
              )}

              <div className="rounded-md border border-[#7CD4AE]/20 bg-[#7CD4AE]/10 p-3 text-[12px] text-[#7CD4AE] flex items-center gap-2">
                <UserCheck size={16} className="shrink-0" />
                <span>
                  Authenticated as <strong className="text-white">{user.email}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:opacity-50"
              >
                {accepting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Joining Workspace…</span>
                  </>
                ) : (
                  <>
                    <span>Accept Invitation & Join</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Success State */}
          {acceptedSuccess && (
            <div className="rounded-lg border border-[#7CD4AE]/30 bg-[#7CD4AE]/10 p-5 text-center">
              <CheckCircle2 size={32} className="mx-auto text-[#7CD4AE]" />
              <h2 className="mt-3 text-[15px] font-semibold text-[#F2F3F5]">Invitation Accepted</h2>
              <p className="mt-1.5 text-[12px] text-[#8A909A]">
                You have joined {workspaceData.workspaceName}. Redirecting to Command Center…
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
