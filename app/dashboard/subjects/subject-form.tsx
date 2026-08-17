"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveSubject, type SubjectState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type SubjectEditTarget = {
  id: string;
  name: string;
  code: string;
  credits: number;
  maxMarks: number;
  passMarks: number;
  semesterId: string;
};
export type SemesterOption = { id: string; label: string };

const initialState: SubjectState = {};

function SubjectFormFields({
  semesters,
  target,
  onDone,
}: {
  semesters: SemesterOption[];
  target?: SubjectEditTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveSubject, initialState);
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
      <TextField id="name" label="Subject name" placeholder="Data Structures" defaultValue={target?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="code" label="Code" placeholder="CS201" defaultValue={target?.code} required />
        <TextField id="credits" label="Credits" type="number" min={0} max={20} defaultValue={target?.credits ?? 4} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="maxMarks"
          label="Maximum marks"
          type="number"
          min={1}
          max={1000}
          defaultValue={target?.maxMarks ?? 100}
          required
        />
        <TextField
          id="passMarks"
          label="Passing marks"
          type="number"
          min={0}
          max={1000}
          defaultValue={target?.passMarks ?? 40}
          required
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create subject"}
      </SubmitButton>
    </form>
  );
}

export function CreateSubjectButton({ semesters }: { semesters: SemesterOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New subject
      </button>
      {open && (
        <Modal title="New subject" onClose={() => setOpen(false)}>
          <SubjectFormFields semesters={semesters} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditSubjectButton({ semesters, target }: { semesters: SemesterOption[]; target: SubjectEditTarget }) {
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
        <Modal title="Edit subject" onClose={() => setOpen(false)}>
          <SubjectFormFields semesters={semesters} target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
