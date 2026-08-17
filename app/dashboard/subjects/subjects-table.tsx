"use client";

import { Trash2 } from "lucide-react";
import { deleteSubject } from "./actions";
import { EditSubjectButton, type SemesterOption } from "./subject-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type SubjectRow = {
  id: string;
  name: string;
  code: string;
  credits: number;
  maxMarks: number;
  passMarks: number;
  semesterId: string;
  semesterLabel: string;
};

export function SubjectsTable({ subjects, semesters }: { subjects: SubjectRow[]; semesters: SemesterOption[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Semester</th>
            <th className="px-4 py-3 font-medium">Credits</th>
            <th className="px-4 py-3 font-medium">Marks (pass/max)</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {subjects.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No subjects yet.
              </td>
            </tr>
          )}
          {subjects.map((subject) => (
            <tr key={subject.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{subject.name}</td>
              <td className="px-4 py-3 text-slate-600">{subject.code}</td>
              <td className="px-4 py-3 text-slate-600">{subject.semesterLabel}</td>
              <td className="px-4 py-3 text-slate-600">{subject.credits}</td>
              <td className="px-4 py-3 text-slate-600">
                {subject.passMarks} / {subject.maxMarks}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <EditSubjectButton
                    semesters={semesters}
                    target={{
                      id: subject.id,
                      name: subject.name,
                      code: subject.code,
                      credits: subject.credits,
                      maxMarks: subject.maxMarks,
                      passMarks: subject.passMarks,
                      semesterId: subject.semesterId,
                    }}
                  />
                  <ConfirmButton
                    title={`Delete ${subject.name}?`}
                    description="This cannot be undone. Deletion will fail if attendance, marks or assignments reference this subject."
                    onConfirm={() => deleteSubject(subject.id)}
                    successMessage="Subject deleted"
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
