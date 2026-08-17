"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateCollegeModules } from "../actions";

export type ModuleRow = { key: string; name: string; description: string | null; enabled: boolean };

export function ModuleToggles({ collegeId, modules }: { collegeId: string; modules: ModuleRow[] }) {
  const [pending, startTransition] = useTransition();

  function handleToggle(moduleKey: string, next: boolean) {
    startTransition(async () => {
      try {
        await updateCollegeModules(collegeId, moduleKey, next);
        toast.success(`${next ? "Enabled" : "Disabled"} module`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {modules.map((m) => (
        <label
          key={m.key}
          className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={m.enabled}
            disabled={pending}
            onChange={(e) => handleToggle(m.key, e.target.checked)}
            className="mt-0.5 rounded border-slate-300"
          />
          <span>
            <span className="block font-medium text-slate-900">{m.name}</span>
            {m.description && <span className="block text-xs text-slate-500">{m.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
