"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { resetCollegeAdminPassword } from "../actions";
import { Modal } from "@/components/dashboard/modal";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";

export function AdminAccess({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      const result = await resetCollegeAdminPassword(collegeId);
      if (result.error) toast.error(result.error);
      else if (result.success) {
        setConfirming(false);
        setIssued(result.success);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <KeyRound className="h-4 w-4" />
        Issue new admin password
      </button>

      {confirming && (
        <Modal
          title="Issue a new College Admin password?"
          description={`This replaces the current password for ${collegeName}'s College Admin. Anyone still using the old one will be signed out at their next sign-in, and the new password must be changed on first use.`}
          onClose={() => setConfirming(false)}
        >
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={pending}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Issue password
            </button>
          </div>
        </Modal>
      )}

      {issued && (
        <CredentialsDialog
          name={`${collegeName} — College Admin`}
          username={issued.username}
          password={issued.password}
          onClose={() => setIssued(null)}
        />
      )}
    </>
  );
}
