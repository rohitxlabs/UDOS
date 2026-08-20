"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Power, Loader2 } from "lucide-react";
import { setCollegeActive } from "./actions";
import { Modal } from "@/components/dashboard/modal";

// Suspending is destructive to the college's working day even though it
// destroys no data — every one of their users is locked out at once — so it
// goes through a confirmation. Reactivating does not: restoring access is
// not something anyone needs protecting from.
export function CollegeStatusToggle({ isActive, collegeName }: { isActive: boolean; collegeName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: boolean) {
    startTransition(async () => {
      try {
        await setCollegeActive(next);
        setConfirming(false);
        toast.success(next ? `${collegeName} reactivated` : `${collegeName} suspended`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => (isActive ? setConfirming(true) : apply(true))}
        disabled={pending}
        className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
        {isActive ? "Suspend college" : "Reactivate college"}
      </button>

      {confirming && (
        <Modal
          title={`Suspend ${collegeName}?`}
          description="Every college user is signed out and cannot sign back in until this is reversed. No data is deleted, and reactivating restores access exactly as it was."
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
              onClick={() => apply(false)}
              disabled={pending}
              className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Suspend
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
