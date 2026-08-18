"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveExam, type ExamState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type SemesterOption = { id: string; label: string };
export type ExamTarget = {
  id: string;
  name: string;
  type: string;
  semesterId: string;
  startDate: string;
  endDate: string;
};

// Common Indian college exam types; free text is still allowed so a college
// with its own vocabulary is not blocked by the platform's assumptions.
const EXAM_TYPES = ["Internal", "Mid-term", "Semester", "Practical", "Viva", "Supplementary"];

const initialState: ExamState = {};

function ExamFields({
  semesters,
  target,
  onDone,
}: {
  semesters: SemesterOption[];
  target?: ExamTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveExam, initialState);
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

      <TextField id="name" label="Examination name" placeholder="Semester End Examination" defaultValue={target?.name} required />

      <SelectField id="type" label="Type" defaultValue={target?.type ?? "Semester"} required>
        {EXAM_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <TextField id="startDate" label="Starts" type="date" defaultValue={target?.startDate} required />
        <TextField id="endDate" label="Ends" type="date" defaultValue={target?.endDate} required />
      </div>

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create examination"}
      </SubmitButton>
    </form>
  );
}

export function CreateExamButton({ semesters }: { semesters: SemesterOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New examination
      </button>
      {open && (
        <Modal title="New examination" onClose={() => setOpen(false)}>
          <ExamFields semesters={semesters} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditExamButton({ semesters, target }: { semesters: SemesterOption[]; target: ExamTarget }) {
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
        <Modal title="Edit examination" onClose={() => setOpen(false)}>
          <ExamFields semesters={semesters} target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
