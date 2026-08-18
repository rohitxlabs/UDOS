"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Send, ShieldCheck, Undo2 } from "lucide-react";
import { saveMarks, submitMarks, verifyMarks, reopenMarks } from "./actions";
import { Badge, type BadgeTone } from "@/components/dashboard/page-header";

export type MarksStatusValue = "DRAFT" | "SUBMITTED" | "VERIFIED";

export type MarksRow = {
  studentId: string;
  name: string;
  roll: string;
  internal: number | null;
  assignmentMarks: number | null;
  practical: number | null;
  viva: number | null;
  theory: number | null;
};

type Field = "internal" | "assignmentMarks" | "practical" | "viva" | "theory";

const FIELDS: { key: Field; label: string }[] = [
  { key: "internal", label: "Internal" },
  { key: "assignmentMarks", label: "Assignment" },
  { key: "practical", label: "Practical" },
  { key: "viva", label: "Viva" },
  { key: "theory", label: "Theory" },
];

const STATUS_TONES: Record<MarksStatusValue, BadgeTone> = {
  DRAFT: "slate",
  SUBMITTED: "amber",
  VERIFIED: "green",
};

type Draft = Record<string, Record<Field, string>>;

function toDraft(rows: MarksRow[]): Draft {
  return Object.fromEntries(
    rows.map((row) => [
      row.studentId,
      {
        internal: row.internal === null ? "" : String(row.internal),
        assignmentMarks: row.assignmentMarks === null ? "" : String(row.assignmentMarks),
        practical: row.practical === null ? "" : String(row.practical),
        viva: row.viva === null ? "" : String(row.viva),
        theory: row.theory === null ? "" : String(row.theory),
      },
    ])
  );
}

export function MarksSheet({
  examSubjectId,
  rows,
  status,
  maxMarks,
  passMarks,
  canEnter,
  canSubmit,
  canApprove,
}: {
  examSubjectId: string;
  rows: MarksRow[];
  status: MarksStatusValue;
  maxMarks: number;
  passMarks: number;
  canEnter: boolean;
  canSubmit: boolean;
  canApprove: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rows));
  const [pending, startTransition] = useTransition();

  const locked = status === "VERIFIED" || !canEnter;

  function total(studentId: string): number | null {
    const entry = draft[studentId];
    if (!entry) return null;
    const values = FIELDS.map((f) => entry[f.key]);
    if (values.every((v) => v === "")) return null;
    return values.reduce((sum, v) => sum + (v === "" ? 0 : Number(v)), 0);
  }

  function run(fn: () => Promise<{ error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else toast.success(successMessage);
    });
  }

  function handleSave() {
    run(
      () =>
        saveMarks({
          examSubjectId,
          entries: rows.map((row) => {
            const entry = draft[row.studentId];
            const num = (value: string) => (value === "" ? null : Number(value));
            return {
              studentId: row.studentId,
              internal: num(entry?.internal ?? ""),
              assignmentMarks: num(entry?.assignmentMarks ?? ""),
              practical: num(entry?.practical ?? ""),
              viva: num(entry?.viva ?? ""),
              theory: num(entry?.theory ?? ""),
            };
          }),
        }),
      "Marks saved as draft"
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[status]}>
            {status === "DRAFT" ? "Draft" : status === "SUBMITTED" ? "Submitted for verification" : "Verified"}
          </Badge>
          <span className="text-sm text-slate-500">
            Pass {passMarks} / Max {maxMarks}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!locked && (
            <button
              onClick={handleSave}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </button>
          )}
          {canSubmit && status === "DRAFT" && (
            <button
              onClick={() => run(() => submitMarks(examSubjectId), "Marks submitted for verification")}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Submit for verification
            </button>
          )}
          {canApprove && status === "SUBMITTED" && (
            <>
              <button
                onClick={() => run(() => reopenMarks(examSubjectId), "Marks reopened for editing")}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Undo2 className="h-4 w-4" />
                Reopen
              </button>
              <button
                onClick={() => run(() => verifyMarks(examSubjectId), "Marks verified and locked")}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Verify &amp; lock
              </button>
            </>
          )}
        </div>
      </div>

      {status === "VERIFIED" && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          This sheet is verified and locked. Results can now be generated from it.
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium">Student</th>
              {FIELDS.map((field) => (
                <th key={field.key} className="px-3 py-3 font-medium">
                  {field.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const rowTotal = total(row.studentId);
              return (
                <tr key={row.studentId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600">{row.roll}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                  {FIELDS.map((field) => (
                    <td key={field.key} className="px-3 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={maxMarks}
                        disabled={locked}
                        value={draft[row.studentId]?.[field.key] ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.studentId]: { ...prev[row.studentId], [field.key]: e.target.value },
                          }))
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 font-medium text-slate-900">{rowTotal ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {rowTotal === null ? (
                      <Badge>Not marked</Badge>
                    ) : rowTotal >= passMarks ? (
                      <Badge tone="green">Pass</Badge>
                    ) : (
                      <Badge tone="red">Fail</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
