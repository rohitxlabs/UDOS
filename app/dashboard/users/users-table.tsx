"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Ban, CheckCircle2 } from "lucide-react";
import { toggleUserActive, resetUserPassword } from "./actions";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/app/generated/prisma/client";

export type UserRow = {
  id: string;
  name: string;
  username: string;
  role: Role;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
};

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const [resetFor, setResetFor] = useState<{ name: string; username: string; password: string } | null>(null);

  function handleToggle(user: UserRow) {
    startTransition(async () => {
      try {
        await toggleUserActive(user.id, !user.isActive);
        toast.success(`${user.name} ${user.isActive ? "deactivated" : "activated"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function handleReset(user: UserRow) {
    startTransition(async () => {
      try {
        const { password } = await resetUserPassword(user.id);
        setResetFor({ name: user.name, username: user.username, password });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Username</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last login</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No users found.
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
              <td className="px-4 py-3 text-slate-600">{user.username}</td>
              <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.role]}</td>
              <td className="px-4 py-3 text-slate-600">
                {user.email || user.phone || <span className="text-slate-400">—</span>}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                    (user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")
                  }
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "Never"}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    disabled={pending}
                    onClick={() => handleReset(user)}
                    title="Reset password"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      disabled={pending}
                      onClick={() => handleToggle(user)}
                      title={user.isActive ? "Deactivate" : "Activate"}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                      {user.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {resetFor && (
        <CredentialsDialog
          name={resetFor.name}
          username={resetFor.username}
          password={resetFor.password}
          onClose={() => setResetFor(null)}
        />
      )}
    </div>
  );
}
