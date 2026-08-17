"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Modal } from "./modal";

export function ConfirmButton({
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  successMessage,
  trigger,
}: {
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  successMessage?: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm();
        if (successMessage) toast.success(successMessage);
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <Modal title={title} description={description} onClose={() => setOpen(false)}>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
