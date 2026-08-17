"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Star } from "lucide-react";
import { setCurrentAcademicYear, deleteAcademicYear } from "./actions";
import { EditAcademicYearButton } from "./academic-year-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type AcademicYearRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export function AcademicYearsTable({ years }: { years: AcademicYearRow[] }) {
  const [pending, startTransition] = useTransition();

  function handleSetCurrent(id: string) {
    startTransition(async () => {
      try {
        await setCurrentAcademicYear(id);
        toast.success("Current academic year updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Start</th>
            <th className="px-4 py-3 font-medium">End</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {years.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No academic years yet.
              </td>
            </tr>
          )}
          {years.map((year) => (
            <tr key={year.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{year.name}</td>
              <td className="px-4 py-3 text-slate-600">{new Date(year.startDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-slate-600">{new Date(year.endDate).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                {year.isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <Star className="h-3 w-3 fill-current" /> Current
                  </span>
                ) : (
                  <button
                    disabled={pending}
                    onClick={() => handleSetCurrent(year.id)}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                  >
                    Set as current
                  </button>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <EditAcademicYearButton
                    target={{ id: year.id, name: year.name, startDate: year.startDate, endDate: year.endDate }}
                  />
                  <ConfirmButton
                    title={`Delete ${year.name}?`}
                    description="This cannot be undone. Deletion will fail if semesters or students still reference this academic year."
                    onConfirm={() => deleteAcademicYear(year.id)}
                    successMessage="Academic year deleted"
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
