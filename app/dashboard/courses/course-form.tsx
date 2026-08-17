"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveCourse, type CourseState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type CourseEditTarget = {
  id: string;
  name: string;
  code: string;
  durationSemesters: number;
  departmentId: string;
};

type DepartmentOption = { id: string; name: string };

const initialState: CourseState = {};

function CourseFormFields({
  departments,
  target,
  onDone,
}: {
  departments: DepartmentOption[];
  target?: CourseEditTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveCourse, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <SelectField id="departmentId" label="Department" defaultValue={target?.departmentId ?? ""} required>
        <option value="" disabled>
          Select department
        </option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>
      <TextField id="name" label="Course name" placeholder="B.Tech Computer Science" defaultValue={target?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="code" label="Code" placeholder="BTCS" defaultValue={target?.code} required />
        <TextField
          id="durationSemesters"
          label="Duration (semesters)"
          type="number"
          min={1}
          max={20}
          defaultValue={target?.durationSemesters ?? 8}
          required
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create course"}
      </SubmitButton>
    </form>
  );
}

export function CreateCourseButton({ departments }: { departments: DepartmentOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New course
      </button>
      {open && (
        <Modal title="New course" onClose={() => setOpen(false)}>
          <CourseFormFields departments={departments} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditCourseButton({ departments, target }: { departments: DepartmentOption[]; target: CourseEditTarget }) {
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
        <Modal title="Edit course" onClose={() => setOpen(false)}>
          <CourseFormFields departments={departments} target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
