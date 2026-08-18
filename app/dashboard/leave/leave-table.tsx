"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Loader2, Trash2, FileText } from "lucide-react";
import { decideLeaveRequest, withdrawLeaveRequest } from "./actions";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Badge, type BadgeTone } from "@/components/dashboard/page-header";

export type LeaveStatusValue = "PENDING" | "APPROVED" | "REJECTED";

export type LeaveRow = {
  id: string;
  userName: string;
  roleName: string | null;
  fromLabel: string;
  toLabel: string;
  days: number;
  reason: string;
  documentUrl: string | null;
  status: LeaveStatusValue;
  decidedLabel: string | null;
  isMine: boolean;
};

const TONES: Record<LeaveStatusValue, BadgeTone> = { PENDING: "amber", APPROVED: "green", REJECTED: "red" };

function DecideButtons({ row }: { row: LeaveRow }) {
  const [pending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideLeaveRequest(row.id, decision);
      if (result.error) toast.error(result.error);
      else toast.success(`Leave ${decision.toLowerCase()}`);
    });
  }

  return (
    <>
      <button
        onClick={() => decide("APPROVED")}
        disabled={pending}
        title="Approve"
        className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        onClick={() => decide("REJECTED")}
        disabled={pending}
        title="Reject"
        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </>
  );
}

export function LeaveTable({ requests, canApprove }: { requests: LeaveRow[]; canApprove: boolean }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Requested by</th>
            <th className="px-4 py-3 font-medium">Dates</th>
            <th className="px-4 py-3 font-medium">Days</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No leave requests.
              </td>
            </tr>
          )}
          {requests.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">
                  {row.userName}
                  {row.isMine && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
                </p>
                <p className="text-xs text-slate-500">{row.roleName ?? "No role"}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                {row.fromLabel} – {row.toLabel}
              </td>
              <td className="px-4 py-3 text-slate-600">{row.days}</td>
              <td className="px-4 py-3 text-slate-600">{row.reason}</td>
              <td className="px-4 py-3">
                <Badge tone={TONES[row.status]}>{row.status.toLowerCase()}</Badge>
                {row.decidedLabel && <p className="mt-1 text-xs text-slate-400">{row.decidedLabel}</p>}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {row.documentUrl && (
                    <a
                      href={row.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Supporting document"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <FileText className="h-4 w-4" />
                    </a>
                  )}
                  {canApprove && row.status === "PENDING" && !row.isMine && <DecideButtons row={row} />}
                  {row.status === "PENDING" && row.isMine && (
                    <ConfirmButton
                      title="Withdraw this request?"
                      description="The request is removed and will not be reviewed."
                      confirmLabel="Withdraw"
                      onConfirm={async () => {
                        const result = await withdrawLeaveRequest(row.id);
                        if (result.error) throw new Error(result.error);
                      }}
                      successMessage="Request withdrawn"
                      trigger={
                        <button title="Withdraw" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
