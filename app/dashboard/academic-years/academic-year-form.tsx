"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveAcademicYear, type AcademicYearState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type AcademicYearEditTarget = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

const initialState: AcademicYearState = {};

function toDateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function AcademicYearFormFields({ target, onDone }: { target?: AcademicYearEditTarget; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveAcademicYear, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // onDone intentionally omitted: it's a fresh closure each render and
    // this should only fire once per successful submission, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <TextField id="name" label="Name" placeholder="2026-27" defaultValue={target?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="startDate" label="Start date" type="date" defaultValue={toDateInput(target?.startDate ?? "")} required />
        <TextField id="endDate" label="End date" type="date" defaultValue={toDateInput(target?.endDate ?? "")} required />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create academic year"}
      </SubmitButton>
    </form>
  );
}

export function CreateAcademicYearButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New academic year
      </button>
      {open && (
        <Modal title="New academic year" onClose={() => setOpen(false)}>
          <AcademicYearFormFields onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditAcademicYearButton({ target }: { target: AcademicYearEditTarget }) {
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
        <Modal title="Edit academic year" onClose={() => setOpen(false)}>
          <AcademicYearFormFields target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
