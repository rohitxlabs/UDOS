"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2 } from "lucide-react";
import { toggleModuleActive } from "./actions";

export type ModuleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  dependsOn: string[];
  collegesUsing: number;
};

export function ModulesTable({ modules }: { modules: ModuleRow[] }) {
  const [pending, startTransition] = useTransition();

  function handleToggle(row: ModuleRow) {
    startTransition(async () => {
      try {
        await toggleModuleActive(row.id, !row.isActive);
        toast.success(`${row.name} ${row.isActive ? "deactivated" : "activated"} platform-wide`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Module</th>
            <th className="px-4 py-3 font-medium">Key</th>
            <th className="px-4 py-3 font-medium">Depends on</th>
            <th className="px-4 py-3 font-medium">Colleges using</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {modules.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{m.name}</td>
              <td className="px-4 py-3 text-slate-600">{m.key}</td>
              <td className="px-4 py-3 text-slate-600">{m.dependsOn.length ? m.dependsOn.join(", ") : "—"}</td>
              <td className="px-4 py-3 text-slate-600">{m.collegesUsing}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                    (m.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")
                  }
                >
                  {m.isActive ? "Active" : "Deactivated"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    disabled={pending}
                    onClick={() => handleToggle(m)}
                    title={m.isActive ? "Deactivate platform-wide" : "Activate"}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    {m.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
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
