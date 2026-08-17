"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveSection, type SectionState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type SectionEditTarget = { id: string; name: string; semesterId: string };
export type SemesterOption = { id: string; label: string };

const initialState: SectionState = {};

function SectionFormFields({
  semesters,
  target,
  onDone,
}: {
  semesters: SemesterOption[];
  target?: SectionEditTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveSection, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <SelectField id="semesterId" label="Semester" defaultValue={target?.semesterId ?? ""} required>
        <option value="" disabled>
          Select semester
        </option>
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <TextField id="name" label="Section name" placeholder="A" defaultValue={target?.name} required />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create section"}
      </SubmitButton>
    </form>
  );
}

export function CreateSectionButton({ semesters }: { semesters: SemesterOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New section
      </button>
      {open && (
        <Modal title="New section" onClose={() => setOpen(false)}>
          <SectionFormFields semesters={semesters} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditSectionButton({ semesters, target }: { semesters: SemesterOption[]; target: SectionEditTarget }) {
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
        <Modal title="Edit section" onClose={() => setOpen(false)}>
          <SectionFormFields semesters={semesters} target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
