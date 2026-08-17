"use client";

import { Trash2 } from "lucide-react";
import { deleteSection } from "./actions";
import { EditSectionButton, type SemesterOption } from "./section-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type SectionRow = {
  id: string;
  name: string;
  semesterId: string;
  semesterLabel: string;
  studentCount: number;
};

export function SectionsTable({ sections, semesters }: { sections: SectionRow[]; semesters: SemesterOption[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Section</th>
            <th className="px-4 py-3 font-medium">Semester</th>
            <th className="px-4 py-3 font-medium">Students</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sections.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                No sections yet.
              </td>
            </tr>
          )}
          {sections.map((section) => (
            <tr key={section.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{section.name}</td>
              <td className="px-4 py-3 text-slate-600">{section.semesterLabel}</td>
              <td className="px-4 py-3 text-slate-600">{section.studentCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <EditSectionButton
                    semesters={semesters}
                    target={{ id: section.id, name: section.name, semesterId: section.semesterId }}
                  />
                  <ConfirmButton
                    title={`Delete section ${section.name}?`}
                    description="This cannot be undone. Deletion will fail if students still reference this section."
                    onConfirm={() => deleteSection(section.id)}
                    successMessage="Section deleted"
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
