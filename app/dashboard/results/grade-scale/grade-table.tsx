"use client";

import { Trash2 } from "lucide-react";
import { deleteGrade } from "../actions";
import { EditGradeButton, type GradeTarget } from "./grade-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export function GradeTable({
  grades,
  canEdit,
  canDelete,
}: {
  grades: GradeTarget[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Grade</th>
            <th className="px-4 py-3 font-medium">Percentage range</th>
            <th className="px-4 py-3 font-medium">Grade point</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grades.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                No grade bands defined yet.
              </td>
            </tr>
          )}
          {grades.map((grade) => (
            <tr key={grade.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{grade.grade}</td>
              <td className="px-4 py-3 text-slate-600">
                {grade.minPercent}% – {grade.maxPercent}%
              </td>
              <td className="px-4 py-3 text-slate-600">{grade.gradePoint}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {canEdit && <EditGradeButton target={grade} />}
                  {canDelete && (
                    <ConfirmButton
                      title={`Delete grade ${grade.grade}?`}
                      description="Results generated after this change will no longer award this grade."
                      onConfirm={() => deleteGrade(grade.id)}
                      successMessage="Grade band deleted"
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
