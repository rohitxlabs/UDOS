"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2 } from "lucide-react";
import { toggleFacultyActive } from "./actions";

export type FacultyRow = {
  id: string;
  name: string;
  employeeId: string;
  departmentName: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

export function FacultyTable({ faculty }: { faculty: FacultyRow[] }) {
  const [pending, startTransition] = useTransition();

  function handleToggle(row: FacultyRow) {
    startTransition(async () => {
      try {
        await toggleFacultyActive(row.id, !row.isActive);
        toast.success(`${row.name} ${row.isActive ? "deactivated" : "activated"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Employee ID</th>
            <th className="px-4 py-3 font-medium">Department</th>
            <th className="px-4 py-3 font-medium">Designation</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {faculty.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No faculty members yet.
              </td>
            </tr>
          )}
          {faculty.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/dashboard/faculty/${row.id}`} className="hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{row.employeeId}</td>
              <td className="px-4 py-3 text-slate-600">{row.departmentName ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{row.designation ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{row.email || row.phone || "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                    (row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")
                  }
                >
                  {row.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    disabled={pending}
                    onClick={() => handleToggle(row)}
                    title={row.isActive ? "Deactivate" : "Activate"}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    {row.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
