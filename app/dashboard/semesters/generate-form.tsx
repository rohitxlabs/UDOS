"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { generateSemesters, type GenerateSemestersState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

type Option = { id: string; name: string };

const initialState: GenerateSemestersState = {};

function GenerateFormFields({
  courses,
  academicYears,
  onDone,
}: {
  courses: Option[];
  academicYears: Option[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(generateSemesters, initialState);
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <SelectField id="courseId" label="Course" defaultValue="" required>
        <option value="" disabled>
          Select course
        </option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField id="academicYearId" label="Academic year" defaultValue="" required>
        <option value="" disabled>
          Select academic year
        </option>
        {academicYears.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </SelectField>
      <p className="text-xs text-slate-500">
        Creates one semester per year of the course&apos;s duration (skips any that already exist).
      </p>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate semesters
      </SubmitButton>
    </form>
  );
}

export function GenerateSemestersButton({ courses, academicYears }: { courses: Option[]; academicYears: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Generate semesters
      </button>
      {open && (
        <Modal title="Generate semesters" onClose={() => setOpen(false)}>
          <GenerateFormFields courses={courses} academicYears={academicYears} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
