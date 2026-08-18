"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveAssignment, type AssignmentState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, TextAreaField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type SectionOption = { id: string; label: string; semesterId: string };
export type SubjectOption = { id: string; label: string; semesterId: string };
export type TeacherOption = { id: string; label: string };

export type AssignmentTarget = {
  id: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  attachmentUrl: string | null;
  deadline: string;
  maxMarks: number;
};

const initialState: AssignmentState = {};

function AssignmentFields({
  sections,
  subjects,
  teachers,
  target,
  onDone,
}: {
  sections: SectionOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  target?: AssignmentTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveAssignment, initialState);
  const [sectionId, setSectionId] = useState(target?.sectionId ?? "");

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  // Subject list follows the chosen section's semester — the server
  // re-checks this, the filtering here just avoids offering invalid pairs.
  const availableSubjects = useMemo(() => {
    const semesterId = sections.find((s) => s.id === sectionId)?.semesterId;
    return semesterId ? subjects.filter((s) => s.semesterId === semesterId) : [];
  }, [sectionId, sections, subjects]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}

      <SelectField
        id="sectionId"
        label="Section"
        value={sectionId}
        onChange={(e) => setSectionId(e.target.value)}
        required
      >
        <option value="" disabled>
          Select section
        </option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>

      <SelectField id="subjectId" label="Subject" defaultValue={target?.subjectId ?? ""} required>
        <option value="" disabled>
          {sectionId ? "Select subject" : "Select a section first"}
        </option>
        {availableSubjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>

      <SelectField id="teacherId" label="Assigned by" defaultValue={target?.teacherId ?? ""} required>
        <option value="" disabled>
          Select teacher
        </option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </SelectField>

      <TextField id="title" label="Title" placeholder="Unit 2 problem set" defaultValue={target?.title} required />
      <TextAreaField id="description" label="Description (optional)" defaultValue={target?.description ?? ""} />
      <TextAreaField id="instructions" label="Instructions (optional)" defaultValue={target?.instructions ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="deadline"
          label="Deadline"
          type="datetime-local"
          defaultValue={target?.deadline ?? ""}
          required
        />
        <TextField
          id="maxMarks"
          label="Maximum marks"
          type="number"
          min={1}
          max={1000}
          defaultValue={target?.maxMarks ?? 20}
          required
        />
      </div>

      <TextField
        id="attachmentUrl"
        label="Attachment link (optional)"
        type="url"
        placeholder="https://…"
        defaultValue={target?.attachmentUrl ?? ""}
      />

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create assignment"}
      </SubmitButton>
    </form>
  );
}

export function CreateAssignmentButton(props: {
  sections: SectionOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New assignment
      </button>
      {open && (
        <Modal title="New assignment" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <AssignmentFields {...props} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditAssignmentButton(props: {
  sections: SectionOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  target: AssignmentTarget;
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
        <Modal title="Edit assignment" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <AssignmentFields {...props} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
