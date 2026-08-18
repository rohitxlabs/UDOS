"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { gradeSubmission } from "../actions";
import { Badge, type BadgeTone } from "@/components/dashboard/page-header";

export type SubmissionStatusValue = "NOT_SUBMITTED" | "SUBMITTED" | "LATE" | "REVIEWED";

export type SubmissionRow = {
  id: string;
  studentName: string;
  roll: string;
  fileUrl: string | null;
  submittedAtLabel: string | null;
  status: SubmissionStatusValue;
  marksObtained: number | null;
  feedback: string | null;
};

const STATUS_TONES: Record<SubmissionStatusValue, BadgeTone> = {
  NOT_SUBMITTED: "slate",
  SUBMITTED: "blue",
  LATE: "amber",
  REVIEWED: "green",
};

const STATUS_LABELS: Record<SubmissionStatusValue, string> = {
  NOT_SUBMITTED: "Not submitted",
  SUBMITTED: "Submitted",
  LATE: "Late",
  REVIEWED: "Reviewed",
};

function SubmissionRowEditor({
  row,
  maxMarks,
  canGrade,
}: {
  row: SubmissionRow;
  maxMarks: number;
  canGrade: boolean;
}) {
  const [marks, setMarks] = useState(row.marksObtained === null ? "" : String(row.marksObtained));
  const [feedback, setFeedback] = useState(row.feedback ?? "");
  const [status, setStatus] = useState<SubmissionStatusValue>(row.status);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await gradeSubmission({
        submissionId: row.id,
        marksObtained: marks === "" ? null : Number(marks),
        feedback,
        status,
      });
      if (result.error) toast.error(result.error);
      else toast.success(`Saved for ${row.studentName}`);
    });
  }

  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-600">{row.roll}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{row.studentName}</p>
        {row.fileUrl && (
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Open submission
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{row.submittedAtLabel ?? "—"}</td>
      <td className="px-4 py-3">
        {canGrade ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubmissionStatusValue)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-600"
          >
            {(Object.keys(STATUS_LABELS) as SubmissionStatusValue[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {canGrade ? (
          <input
            type="number"
            min={0}
            max={maxMarks}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            placeholder="—"
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-600"
          />
        ) : (
          <span className="text-slate-600">{row.marksObtained ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canGrade ? (
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback"
            className="w-full min-w-[160px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-600"
          />
        ) : (
          <span className="text-slate-600">{row.feedback ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {canGrade && (
          <button
            onClick={handleSave}
            disabled={pending}
            title="Save"
            className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
        )}
      </td>
    </tr>
  );
}

export function SubmissionsPanel({
  submissions,
  maxMarks,
  canGrade,
}: {
  submissions: SubmissionRow[];
  maxMarks: number;
  canGrade: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Roll</th>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Submitted</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Marks / {maxMarks}</th>
            <th className="px-4 py-3 font-medium">Feedback</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {submissions.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No students are assigned to this section yet.
              </td>
            </tr>
          )}
          {submissions.map((row) => (
            <SubmissionRowEditor key={row.id} row={row} maxMarks={maxMarks} canGrade={canGrade} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
