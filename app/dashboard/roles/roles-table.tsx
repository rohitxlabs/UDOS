"use client";

import Link from "next/link";
import { Trash2, Lock } from "lucide-react";
import { deleteRole } from "./actions";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type RoleRow = { id: string; name: string; isSystem: boolean; userCount: number };

export function RolesTable({ roles }: { roles: RoleRow[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Users</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roles.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                No roles yet.
              </td>
            </tr>
          )}
          {roles.map((role) => (
            <tr key={role.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/dashboard/roles/${role.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                  {role.name}
                  {role.isSystem && <Lock className="h-3 w-3 text-slate-400" />}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{role.userCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {!role.isSystem && (
                    <ConfirmButton
                      title={`Delete ${role.name}?`}
                      description="This cannot be undone. Deletion will fail if users still have this role."
                      onConfirm={() => deleteRole(role.id)}
                      successMessage="Role deleted"
                      trigger={
                        <button
                          title="Delete"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
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
