"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { updateCollegeModules } from "../actions";

export type ModuleRow = { key: string; name: string; description: string | null; enabled: boolean };

export function ModuleToggles({ collegeId, modules }: { collegeId: string; modules: ModuleRow[] }) {
  const [, startTransition] = useTransition();

  // The checkbox is driven by server state, which only catches up after the
  // action and its revalidation complete — about a second. Without this the
  // box visibly snapped back to its old value in the meantime, which reads
  // as "the click didn't register" and invites a second click that undoes
  // the first. useOptimistic shows the new value immediately and rolls it
  // back by itself if the action fails.
  const [optimisticModules, applyOptimistic] = useOptimistic(
    modules,
    (state: ModuleRow[], change: { key: string; enabled: boolean }) =>
      state.map((m) => (m.key === change.key ? { ...m, enabled: change.enabled } : m))
  );

  function handleToggle(moduleKey: string, next: boolean) {
    startTransition(async () => {
      applyOptimistic({ key: moduleKey, enabled: next });
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
      {optimisticModules.map((m) => (
        <label
          key={m.key}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={m.enabled}
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
