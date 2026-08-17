"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setRolePermission } from "../actions";
import type { Capability, Module } from "@/lib/permissions";

const ACTIONS: Capability[] = ["view", "create", "edit", "delete", "approve", "export", "print"];
const ACTION_LABELS: Record<Capability, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
  print: "Print",
};

export type ModuleRow = { key: Module; label: string };

export function PermissionGrid({
  roleId,
  modules,
  granted,
  readOnly,
}: {
  roleId: string;
  modules: ModuleRow[];
  granted: Set<string>;
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle(moduleKey: Module, action: Capability, next: boolean) {
    startTransition(async () => {
      try {
        await setRolePermission(roleId, moduleKey, action, next);
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
            {ACTIONS.map((action) => (
              <th key={action} className="px-3 py-3 text-center font-medium">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {modules.map((m) => (
            <tr key={m.key} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{m.label}</td>
              {ACTIONS.map((action) => {
                const key = `${m.key}:${action}`;
                return (
                  <td key={action} className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      disabled={pending || readOnly}
                      defaultChecked={granted.has(key)}
                      onChange={(e) => handleToggle(m.key, action, e.target.checked)}
                      className="rounded border-slate-300"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
