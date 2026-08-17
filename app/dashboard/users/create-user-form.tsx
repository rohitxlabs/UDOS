"use client";

import { useActionState, useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { createStaffUser, type CreateUserState } from "./actions";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { ROLE_LABELS, STAFF_CREATABLE_ROLES } from "@/lib/permissions";

const initialState: CreateUserState = {};

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction, pending] = useActionState(createStaffUser, initialState);

  // Adjust state during render (React's recommended alternative to an
  // effect here) when a new success result arrives from the action.
  const [lastSuccess, setLastSuccess] = useState(state.success);
  if (state.success !== lastSuccess) {
    setLastSuccess(state.success);
    if (state.success) {
      setOpen(false);
      setDismissed(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" />
        New user
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-900">Create staff account</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Teacher, Student and Parent logins are created from Faculty / Student Management.
            </p>

            <form action={formAction} className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="role" className="text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue=""
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  {STAFF_CREATABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email (optional)
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                    Phone (optional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="self-start text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              >
                {advanced ? "Hide" : "Set"} custom username / password
              </button>

              {advanced && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customUsername" className="text-xs font-medium text-slate-600">
                      Username
                    </label>
                    <input
                      id="customUsername"
                      name="customUsername"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customPassword" className="text-xs font-medium text-slate-600">
                      Password
                    </label>
                    <input
                      id="customPassword"
                      name="customPassword"
                      type="text"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              )}

              {state.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </button>
            </form>
          </div>
        </div>
      )}

      {state.success && !dismissed && (
        <CredentialsDialog
          name={state.success.name}
          username={state.success.username}
          password={state.success.password}
          onClose={() => setDismissed(true)}
        />
      )}
    </>
  );
}
