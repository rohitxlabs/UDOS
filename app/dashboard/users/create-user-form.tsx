"use client";

import { useActionState, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createUser, type CreateUserState } from "./actions";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

type RoleOption = { id: string; name: string };

const initialState: CreateUserState = {};

function CreateUserFormFields({ roles, onDone }: { roles: RoleOption[]; onDone: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const [dismissed, setDismissed] = useState(false);

  const [lastSuccess, setLastSuccess] = useState(state.success);
  if (state.success !== lastSuccess) {
    setLastSuccess(state.success);
    if (state.success) setDismissed(false);
  }

  if (state.success && !dismissed) {
    return (
      <CredentialsDialog
        name={state.success.name}
        username={state.success.username}
        password={state.success.password}
        onClose={() => {
          setDismissed(true);
          onDone();
        }}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <TextField id="name" label="Full name" required />

      <SelectField id="roleId" label="Role" defaultValue="" required>
        <option value="" disabled>
          Select a role
        </option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </SelectField>
      <p className="-mt-1.5 text-xs text-slate-500">
        Creating a Teacher or Student account here won&apos;t create a linked profile — use Faculty / Student
        Management for that.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <TextField id="email" label="Email (optional)" type="email" />
        <TextField id="phone" label="Phone (optional)" />
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="self-start text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        {advanced ? "Hide" : "Set"} custom username / password
      </button>

      {advanced && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
          <TextField id="customUsername" label="Username" />
          <TextField id="customPassword" label="Password" />
        </div>
      )}

      <FormError message={state.error} />

      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </SubmitButton>
    </form>
  );
}

export function CreateUserForm({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New user
      </button>

      {open && (
        <Modal title="Create account" onClose={() => setOpen(false)}>
          <CreateUserFormFields roles={roles} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
