"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { submitLeaveRequest, type LeaveState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, TextAreaField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type UserOption = { id: string; label: string };

const initialState: LeaveState = {};

function LeaveFields({ users, onDone }: { users: UserOption[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(submitLeaveRequest, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {/* Only shown to someone allowed to file on another person's behalf;
          for everyone else the server defaults to their own account. */}
      {users.length > 0 && (
        <SelectField id="userId" label="On behalf of" defaultValue="">
          <option value="">Myself</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </SelectField>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField id="fromDate" label="From" type="date" defaultValue={today} required />
        <TextField id="toDate" label="To" type="date" defaultValue={today} required />
      </div>

      <TextAreaField id="reason" label="Reason" placeholder="Medical leave" required />
      <TextField id="documentUrl" label="Supporting document (optional)" type="url" placeholder="https://…" />

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit request
      </SubmitButton>
    </form>
  );
}

export function RequestLeaveButton({ users }: { users: UserOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Request leave
      </button>
      {open && (
        <Modal title="Request leave" onClose={() => setOpen(false)}>
          <LeaveFields users={users} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
