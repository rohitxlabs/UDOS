"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, IdCard, Send, Undo2, Printer } from "lucide-react";
import { generateAdmitCards, releaseAdmitCards, withdrawAdmitCards } from "./actions";
import { Badge } from "@/components/dashboard/page-header";

export type AdmitCardRow = {
  id: string;
  studentName: string;
  roll: string;
  released: boolean;
  releasedAtLabel: string | null;
};

export function AdmitCardsPanel({
  examId,
  rows,
  eligibleCount,
  canGenerate,
  canApprove,
  canPrint,
}: {
  examId: string;
  rows: AdmitCardRow[];
  eligibleCount: number;
  canGenerate: boolean;
  canApprove: boolean;
  canPrint: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run<T extends { error?: string }>(fn: () => Promise<T>, success: (result: T) => string) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else toast.success(success(result));
    });
  }

  const releasedCount = rows.filter((r) => r.released).length;
  const allReleased = rows.length > 0 && releasedCount === rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {rows.length === 0 ? (
            <Badge>Not generated</Badge>
          ) : allReleased ? (
            <Badge tone="green">Released</Badge>
          ) : releasedCount > 0 ? (
            <Badge tone="amber">Partially released</Badge>
          ) : (
            <Badge tone="blue">Generated, not released</Badge>
          )}
          <span className="text-sm text-slate-500">
            {rows.length} card{rows.length === 1 ? "" : "s"} · {eligibleCount} eligible student
            {eligibleCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <button
              onClick={() =>
                run(() => generateAdmitCards(examId), (r) => `${r.generated} generated, ${r.skipped} already existed`)
              }
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
              {rows.length === 0 ? "Generate admit cards" : "Regenerate"}
            </button>
          )}
          {canApprove && rows.length > 0 && !allReleased && (
            <button
              onClick={() => run(() => releaseAdmitCards(examId), (r) => `Released ${r.released} admit cards`)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Release to students
            </button>
          )}
          {canApprove && releasedCount > 0 && (
            <button
              onClick={() => run(() => withdrawAdmitCards(examId), () => "Admit cards withdrawn")}
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
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Released</th>
              <th className="px-4 py-3 text-right font-medium">Card</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No admit cards generated for this examination yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{row.roll}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                <td className="px-4 py-3">
                  {row.released ? <Badge tone="green">Released</Badge> : <Badge>Withheld</Badge>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.releasedAtLabel ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canPrint && (
                    <Link
                      href={`/dashboard/admit-cards/${row.id}`}
                      title="Open printable admit card"
                      className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
