"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Calculator, Send, Undo2 } from "lucide-react";
import { generateResults, publishResults, unpublishResults } from "./actions";
import { Badge, type BadgeTone } from "@/components/dashboard/page-header";

export type ResultStatusValue = "PASS" | "FAIL" | "BACKLOG";

export type ResultRow = {
  id: string;
  studentName: string;
  roll: string;
  totalMarks: number | null;
  percentage: string | null;
  sgpa: string | null;
  cgpa: string | null;
  status: ResultStatusValue | null;
  published: boolean;
};

const TONES: Record<ResultStatusValue, BadgeTone> = { PASS: "green", FAIL: "red", BACKLOG: "amber" };

export function ResultsPanel({
  examId,
  rows,
  publishedCount,
  canGenerate,
  canApprove,
}: {
  examId: string;
  rows: ResultRow[];
  publishedCount: number;
  canGenerate: boolean;
  canApprove: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run<T extends { error?: string }>(fn: () => Promise<T>, success: (result: T) => string) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else toast.success(success(result));
    });
  }

  const allPublished = rows.length > 0 && publishedCount === rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {rows.length === 0 ? (
            <Badge>Not generated</Badge>
          ) : allPublished ? (
            <Badge tone="green">Published</Badge>
          ) : publishedCount > 0 ? (
            <Badge tone="amber">Partially published</Badge>
          ) : (
            <Badge tone="blue">Generated, not published</Badge>
          )}
          <span className="text-sm text-slate-500">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <button
              onClick={() => run(() => generateResults(examId), (r) => `Generated ${r.generated} results`)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {rows.length === 0 ? "Generate results" : "Recompute"}
            </button>
          )}
          {canApprove && rows.length > 0 && !allPublished && (
            <button
              onClick={() => run(() => publishResults(examId), (r) => `Published ${r.published} results`)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Publish
            </button>
          )}
          {canApprove && publishedCount > 0 && (
            <button
              onClick={() => run(() => unpublishResults(examId), () => "Results withdrawn")}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Undo2 className="h-4 w-4" />
              Withdraw
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Percentage</th>
              <th className="px-4 py-3 font-medium">SGPA</th>
              <th className="px-4 py-3 font-medium">CGPA</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Visibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No results generated for this examination yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{row.roll}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                <td className="px-4 py-3 text-slate-600">{row.totalMarks ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.percentage ? `${row.percentage}%` : "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.sgpa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.cgpa ?? "—"}</td>
                <td className="px-4 py-3">{row.status ? <Badge tone={TONES[row.status]}>{row.status}</Badge> : "—"}</td>
                <td className="px-4 py-3">
                  {row.published ? <Badge tone="green">Published</Badge> : <Badge>Withheld</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
