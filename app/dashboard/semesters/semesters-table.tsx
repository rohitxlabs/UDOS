"use client";

import { Trash2 } from "lucide-react";
import { deleteSemester } from "./actions";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type SemesterRow = {
  id: string;
  number: number;
  name: string;
  courseName: string;
  academicYearName: string;
  sectionCount: number;
  subjectCount: number;
};

export function SemestersTable({ semesters }: { semesters: SemesterRow[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">Academic year</th>
            <th className="px-4 py-3 font-medium">Semester</th>
            <th className="px-4 py-3 font-medium">Sections</th>
            <th className="px-4 py-3 font-medium">Subjects</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {semesters.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No semesters yet.
              </td>
            </tr>
          )}
          {semesters.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{s.courseName}</td>
              <td className="px-4 py-3 text-slate-600">{s.academicYearName}</td>
              <td className="px-4 py-3 text-slate-600">{s.name}</td>
              <td className="px-4 py-3 text-slate-600">{s.sectionCount}</td>
              <td className="px-4 py-3 text-slate-600">{s.subjectCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <ConfirmButton
                    title={`Delete ${s.courseName} — ${s.name}?`}
                    description="This cannot be undone. Deletion will fail if sections, subjects or students still reference this semester."
                    onConfirm={() => deleteSemester(s.id)}
                    successMessage="Semester deleted"
                    trigger={
                      <button
                        title="Delete"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
