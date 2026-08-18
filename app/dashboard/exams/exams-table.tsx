"use client";

import Link from "next/link";
import { Trash2, ArrowUpRight } from "lucide-react";
import { deleteExam } from "./actions";
import { EditExamButton, type ExamTarget, type SemesterOption } from "./exam-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Badge } from "@/components/dashboard/page-header";

export type ExamRow = ExamTarget & {
  semesterLabel: string;
  rangeLabel: string;
  subjectCount: number;
  phase: "Upcoming" | "In progress" | "Completed";
};

const PHASE_TONES = { Upcoming: "blue", "In progress": "amber", Completed: "slate" } as const;

export function ExamsTable({
  exams,
  semesters,
  canEdit,
  canDelete,
}: {
  exams: ExamRow[];
  semesters: SemesterOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Examination</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Semester</th>
            <th className="px-4 py-3 font-medium">Dates</th>
            <th className="px-4 py-3 font-medium">Subjects</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {exams.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No examinations scheduled yet.
              </td>
            </tr>
          )}
          {exams.map((exam) => (
            <tr key={exam.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/dashboard/exams/${exam.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                  {exam.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{exam.type}</td>
              <td className="px-4 py-3 text-slate-600">{exam.semesterLabel}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{exam.rangeLabel}</td>
              <td className="px-4 py-3 text-slate-600">{exam.subjectCount}</td>
              <td className="px-4 py-3">
                <Badge tone={PHASE_TONES[exam.phase]}>{exam.phase}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Link
                    href={`/dashboard/exams/${exam.id}`}
                    title="Open"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {canEdit && <EditExamButton semesters={semesters} target={exam} />}
                  {canDelete && (
                    <ConfirmButton
                      title={`Delete ${exam.name}?`}
                      description="The schedule, eligibility, marks, results and admit cards for this examination will be removed."
                      onConfirm={() => deleteExam(exam.id)}
                      successMessage="Examination deleted"
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
