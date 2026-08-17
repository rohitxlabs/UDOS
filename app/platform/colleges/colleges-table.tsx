"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2 } from "lucide-react";
import { toggleCollegeActive } from "./actions";

export type CollegeRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  moduleCount: number;
  createdAt: string;
};

export function CollegesTable({ colleges }: { colleges: CollegeRow[] }) {
  const [pending, startTransition] = useTransition();

  function handleToggle(row: CollegeRow) {
    startTransition(async () => {
      try {
        await toggleCollegeActive(row.id, !row.isActive);
        toast.success(`${row.name} ${row.isActive ? "suspended" : "reactivated"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">College</th>
            <th className="px-4 py-3 font-medium">Slug</th>
            <th className="px-4 py-3 font-medium">Modules</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {colleges.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No colleges onboarded yet.
              </td>
            </tr>
          )}
          {colleges.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/platform/colleges/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{c.slug}</td>
              <td className="px-4 py-3 text-slate-600">{c.moduleCount}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                    (c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")
                  }
                >
                  {c.isActive ? "Active" : "Suspended"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    disabled={pending}
                    onClick={() => handleToggle(c)}
                    title={c.isActive ? "Suspend" : "Reactivate"}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    {c.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
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
