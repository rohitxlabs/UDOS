"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveDepartment, type DepartmentState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type DepartmentEditTarget = { id: string; name: string; code: string };

const initialState: DepartmentState = {};

function DepartmentFormFields({ target, onDone }: { target?: DepartmentEditTarget; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveDepartment, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <TextField id="name" label="Department name" placeholder="Computer Science" defaultValue={target?.name} required />
      <TextField id="code" label="Code" placeholder="CSE" defaultValue={target?.code} required />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create department"}
      </SubmitButton>
    </form>
  );
}

export function CreateDepartmentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New department
      </button>
      {open && (
        <Modal title="New department" onClose={() => setOpen(false)}>
          <DepartmentFormFields onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditDepartmentButton({ target }: { target: DepartmentEditTarget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit"
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {open && (
        <Modal title="Edit department" onClose={() => setOpen(false)}>
          <DepartmentFormFields target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
