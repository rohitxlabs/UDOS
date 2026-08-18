"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveScholarship, type ScholarshipState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, TextAreaField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type StudentOption = { id: string; label: string };
export type YearOption = { id: string; label: string };

export type ScholarshipTarget = {
  id: string;
  studentId: string;
  academicYearId: string;
  name: string;
  amount: string;
  reason: string | null;
  documentUrl: string | null;
};

const initialState: ScholarshipState = {};

function ScholarshipFields({
  students,
  years,
  target,
  onDone,
}: {
  students: StudentOption[];
  years: YearOption[];
  target?: ScholarshipTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveScholarship, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}

      <SelectField id="studentId" label="Student" defaultValue={target?.studentId ?? ""} required>
        <option value="" disabled>
          Select student
        </option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <SelectField id="academicYearId" label="Academic year" defaultValue={target?.academicYearId ?? ""} required>
          <option value="" disabled>
            Select year
          </option>
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="amount"
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          defaultValue={target?.amount}
          required
        />
      </div>

      <TextField
        id="name"
        label="Scholarship"
        placeholder="Merit scholarship"
        defaultValue={target?.name}
        required
      />
      <TextAreaField id="reason" label="Reason (optional)" defaultValue={target?.reason ?? ""} />
      <TextField
        id="documentUrl"
        label="Supporting document (optional)"
        type="url"
        placeholder="https://…"
        defaultValue={target?.documentUrl ?? ""}
      />

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Add scholarship"}
      </SubmitButton>
    </form>
  );
}

export function CreateScholarshipButton(props: { students: StudentOption[]; years: YearOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New scholarship
      </button>
      {open && (
        <Modal title="New scholarship" onClose={() => setOpen(false)}>
          <ScholarshipFields {...props} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditScholarshipButton(props: {
  students: StudentOption[];
  years: YearOption[];
  target: ScholarshipTarget;
}) {
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
        <Modal title="Edit scholarship" onClose={() => setOpen(false)}>
          <ScholarshipFields {...props} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
