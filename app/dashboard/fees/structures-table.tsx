"use client";

import Link from "next/link";
import { Trash2, ArrowUpRight } from "lucide-react";
import { deleteFeeStructure } from "./actions";
import {
  EditStructureButton,
  type StructureTarget,
  type YearOption,
  type CourseOption,
  type SemesterOption,
} from "./fee-structure-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type StructureRow = StructureTarget & {
  scopeLabel: string;
  yearLabel: string;
  totalLabel: string;
  billedCount: number;
};

export function StructuresTable({
  structures,
  years,
  courses,
  semesters,
  canEdit,
  canDelete,
}: {
  structures: StructureRow[];
  years: YearOption[];
  courses: CourseOption[];
  semesters: SemesterOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Structure</th>
            <th className="px-4 py-3 font-medium">Applies to</th>
            <th className="px-4 py-3 font-medium">Academic year</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Students billed</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {structures.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No fee structures defined yet.
              </td>
            </tr>
          )}
          {structures.map((structure) => (
            <tr key={structure.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/dashboard/fees/${structure.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                  {structure.name}
                </Link>
                {structure.category && <p className="text-xs text-slate-500">{structure.category}</p>}
              </td>
              <td className="px-4 py-3 text-slate-600">{structure.scopeLabel}</td>
              <td className="px-4 py-3 text-slate-600">{structure.yearLabel}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{structure.totalLabel}</td>
              <td className="px-4 py-3 text-slate-600">{structure.billedCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Link
                    href={`/dashboard/fees/${structure.id}`}
                    title="Open"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {canEdit && (
                    <EditStructureButton years={years} courses={courses} semesters={semesters} target={structure} />
                  )}
                  {canDelete && (
                    <ConfirmButton
                      title={`Delete ${structure.name}?`}
                      description="Deletion will fail while students are still billed under this structure."
                      onConfirm={() => deleteFeeStructure(structure.id)}
                      successMessage="Fee structure deleted"
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
