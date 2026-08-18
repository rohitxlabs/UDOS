"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { recomputeEligibility, overrideEligibility } from "../actions";
import { Modal } from "@/components/dashboard/modal";
import { Badge, type BadgeTone } from "@/components/dashboard/page-header";
import { TextAreaField, SelectField } from "@/components/dashboard/form-field";

export type EligibilityStatusValue = "ELIGIBLE" | "NOT_ELIGIBLE" | "PENDING_VERIFICATION";

export type EligibilityRow = {
  id: string;
  studentName: string;
  roll: string;
  status: EligibilityStatusValue;
  reason: string | null;
  overridden: boolean;
};

const TONES: Record<EligibilityStatusValue, BadgeTone> = {
  ELIGIBLE: "green",
  NOT_ELIGIBLE: "red",
  PENDING_VERIFICATION: "amber",
};
const LABELS: Record<EligibilityStatusValue, string> = {
  ELIGIBLE: "Eligible",
  NOT_ELIGIBLE: "Not eligible",
  PENDING_VERIFICATION: "Pending",
};

function OverrideDialog({ row, onClose }: { row: EligibilityRow; onClose: () => void }) {
  const [status, setStatus] = useState<EligibilityStatusValue>(row.status);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await overrideEligibility({ eligibilityId: row.id, status, reason });
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Eligibility updated for ${row.studentName}`);
        onClose();
      }
    });
  }

  return (
    <Modal
      title={`Override eligibility — ${row.studentName}`}
      description="Overrides are recorded in the audit log with the reason given."
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <SelectField
          id="status"
          label="Eligibility"
          value={status}
          onChange={(e) => setStatus(e.target.value as EligibilityStatusValue)}
        >
          {(Object.keys(LABELS) as EligibilityStatusValue[]).map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          id="reason"
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Medical leave approved by the principal"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save override
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EligibilityPanel({
  examId,
  rows,
  canApprove,
}: {
  examId: string;
  rows: EligibilityRow[];
  canApprove: boolean;
}) {
  const [overriding, setOverriding] = useState<EligibilityRow | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRecompute() {
    startTransition(async () => {
      const result = await recomputeEligibility(examId);
      if (result.error) toast.error(result.error);
      else toast.success(`${result.eligible} eligible, ${result.blocked} blocked`);
    });
  }

  const blocked = rows.filter((r) => r.status === "NOT_ELIGIBLE").length;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Exam eligibility</h2>
          <p className="text-xs text-slate-500">
            Computed from the college&apos;s own attendance requirement. {blocked} currently blocked.
          </p>
        </div>
        {canApprove && (
          <button
            onClick={handleRecompute}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recompute
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Eligibility has not been computed for this examination yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{row.roll}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={TONES[row.status]}>{LABELS[row.status]}</Badge>
                    {row.overridden && <Badge tone="violet">Overridden</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.reason ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canApprove && (
                    <button
                      onClick={() => setOverriding(row)}
                      title="Override"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overriding && <OverrideDialog row={overriding} onClose={() => setOverriding(null)} />}
    </div>
  );
}
