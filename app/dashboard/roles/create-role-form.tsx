"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createRole, type CreateRoleState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

const initialState: CreateRoleState = {};

function CreateRoleFormFields({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createRole, initialState);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <TextField id="name" label="Role name" placeholder="Accountant" required />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create role
      </SubmitButton>
    </form>
  );
}

export function CreateRoleButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New role
      </button>
      {open && (
        <Modal title="New role" onClose={() => setOpen(false)}>
          <CreateRoleFormFields onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
