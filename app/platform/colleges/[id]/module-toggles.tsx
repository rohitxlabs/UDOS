"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { updateCollegeModules } from "../actions";
import { moduleWithPrerequisites, moduleWithDependents, type Module } from "@/lib/permissions";

export type ModuleRow = {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  requires: string[];
};

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
    (state: ModuleRow[], change: { keys: string[]; enabled: boolean }) =>
      state.map((m) => (change.keys.includes(m.key) ? { ...m, enabled: change.enabled } : m))
  );

  const nameOf = (key: string) => modules.find((m) => m.key === key)?.name ?? key;

  function handleToggle(moduleKey: string, next: boolean) {
    // Predict the same closure the server will apply, so the whole group
    // ticks at once instead of one box moving and the rest arriving later.
    const predicted = (next ? moduleWithPrerequisites(moduleKey as Module) : moduleWithDependents(moduleKey as Module))
      .filter((key) => modules.some((m) => m.key === key && m.enabled !== next));

    startTransition(async () => {
      applyOptimistic({ keys: predicted, enabled: next });
      try {
        const { changed } = await updateCollegeModules(collegeId, moduleKey, next);
        const others = changed.filter((k) => k !== moduleKey);
        if (changed.length === 0) return;
        toast.success(
          others.length === 0
            ? `${next ? "Enabled" : "Disabled"} ${nameOf(moduleKey)}`
            : `${next ? "Enabled" : "Disabled"} ${nameOf(moduleKey)} and ${others.length} it ${
                next ? "needs" : "supports"
              }: ${others.map(nameOf).join(", ")}`
        );
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
          <span className="min-w-0">
            <span className="block font-medium text-slate-900">{m.name}</span>
            {m.description && <span className="block text-xs text-slate-500">{m.description}</span>}
            {m.requires.length > 0 && (
              <span className="mt-0.5 block text-xs text-slate-400">
                Needs {m.requires.map(nameOf).join(", ")}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
