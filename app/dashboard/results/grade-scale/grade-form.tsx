"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveGrade, type GradeState } from "../actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type GradeTarget = {
  id: string;
  grade: string;
  minPercent: string;
  maxPercent: string;
  gradePoint: string;
};

const initialState: GradeState = {};

function GradeFields({ target, onDone }: { target?: GradeTarget; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveGrade, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <div className="grid grid-cols-2 gap-3">
        <TextField id="grade" label="Grade" placeholder="A+" defaultValue={target?.grade} required />
        <TextField
          id="gradePoint"
          label="Grade point"
          type="number"
          step="0.01"
          min={0}
          max={10}
          defaultValue={target?.gradePoint ?? "10"}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="minPercent"
          label="From (%)"
          type="number"
          step="0.01"
          min={0}
          max={100}
          defaultValue={target?.minPercent ?? "90"}
          required
        />
        <TextField
          id="maxPercent"
          label="To (%)"
          type="number"
          step="0.01"
          min={0}
          max={100}
          defaultValue={target?.maxPercent ?? "100"}
          required
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Add grade band"}
      </SubmitButton>
    </form>
  );
}

export function CreateGradeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Add grade band
      </button>
      {open && (
        <Modal title="Add grade band" onClose={() => setOpen(false)}>
          <GradeFields onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditGradeButton({ target }: { target: GradeTarget }) {
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
        <Modal title="Edit grade band" onClose={() => setOpen(false)}>
          <GradeFields target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
