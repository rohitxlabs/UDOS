"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Check, Loader2, FileText } from "lucide-react";
import { deleteScholarship, approveScholarship } from "./actions";
import {
  EditScholarshipButton,
  type ScholarshipTarget,
  type StudentOption,
  type YearOption,
} from "./scholarship-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Badge } from "@/components/dashboard/page-header";

export type ScholarshipRow = ScholarshipTarget & {
  studentName: string;
  roll: string;
  yearLabel: string;
  amountLabel: string;
  approved: boolean;
  approvedAtLabel: string | null;
};

function ApproveButton({ row }: { row: ScholarshipRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const result = await approveScholarship(row.id);
          if (result.error) toast.error(result.error);
          else toast.success(`Approved ${row.name} for ${row.studentName}`);
        })
      }
      disabled={pending}
      title="Approve"
      className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
    </button>
  );
}

export function ScholarshipsTable({
  scholarships,
  students,
  years,
  canEdit,
  canDelete,
  canApprove,
}: {
  scholarships: ScholarshipRow[];
  students: StudentOption[];
  years: YearOption[];
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Scholarship</th>
            <th className="px-4 py-3 font-medium">Academic year</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {scholarships.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No scholarships recorded yet.
              </td>
            </tr>
          )}
          {scholarships.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{row.studentName}</p>
                <p className="text-xs text-slate-500">{row.roll}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-slate-900">{row.name}</p>
                {row.reason && <p className="text-xs text-slate-500">{row.reason}</p>}
              </td>
              <td className="px-4 py-3 text-slate-600">{row.yearLabel}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{row.amountLabel}</td>
              <td className="px-4 py-3">
                {row.approved ? (
                  <div>
                    <Badge tone="green">Approved</Badge>
                    <p className="mt-1 text-xs text-slate-400">{row.approvedAtLabel}</p>
                  </div>
                ) : (
                  <Badge tone="amber">Pending approval</Badge>
                )}
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
                  {canApprove && !row.approved && <ApproveButton row={row} />}
                  {canEdit && !row.approved && (
                    <EditScholarshipButton students={students} years={years} target={row} />
                  )}
                  {canDelete && !row.approved && (
                    <ConfirmButton
                      title={`Delete ${row.name}?`}
                      description={`This removes the pending award for ${row.studentName}.`}
                      onConfirm={() => deleteScholarship(row.id)}
                      successMessage="Scholarship deleted"
                      trigger={
                        <button title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
