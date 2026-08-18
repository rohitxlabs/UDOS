"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveNotice, type NoticeState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, TextAreaField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type AudienceValue =
  | "ALL"
  | "STUDENTS"
  | "TEACHERS"
  | "ACCOUNTS"
  | "MANAGEMENT"
  | "DEPARTMENT"
  | "COURSE"
  | "SEMESTER"
  | "SECTION";

export const AUDIENCE_LABELS: Record<AudienceValue, string> = {
  ALL: "Everyone",
  STUDENTS: "All students",
  TEACHERS: "All teachers",
  ACCOUNTS: "Accounts staff",
  MANAGEMENT: "Management",
  DEPARTMENT: "A department",
  COURSE: "A course",
  SEMESTER: "A semester",
  SECTION: "A section",
};

export type TargetOption = { id: string; label: string };
export type Targets = {
  departments: TargetOption[];
  courses: TargetOption[];
  semesters: TargetOption[];
  sections: TargetOption[];
};

export type NoticeTarget = {
  id: string;
  title: string;
  description: string;
  attachmentUrl: string | null;
  publishDate: string;
  expiryDate: string | null;
  audience: AudienceValue;
  targetId: string | null;
};

const SCOPED: AudienceValue[] = ["DEPARTMENT", "COURSE", "SEMESTER", "SECTION"];

const initialState: NoticeState = {};

function NoticeFields({
  targets,
  target,
  onDone,
}: {
  targets: Targets;
  target?: NoticeTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveNotice, initialState);
  const [audience, setAudience] = useState<AudienceValue>(target?.audience ?? "ALL");

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const options =
    audience === "DEPARTMENT"
      ? targets.departments
      : audience === "COURSE"
        ? targets.courses
        : audience === "SEMESTER"
          ? targets.semesters
          : audience === "SECTION"
            ? targets.sections
            : [];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}

      <TextField id="title" label="Title" placeholder="Semester break schedule" defaultValue={target?.title} required />
      <TextAreaField id="description" label="Notice" defaultValue={target?.description} required />

      <div className="grid grid-cols-2 gap-3">
        <TextField id="publishDate" label="Publish on" type="date" defaultValue={target?.publishDate} required />
        <TextField id="expiryDate" label="Expires (optional)" type="date" defaultValue={target?.expiryDate ?? ""} />
      </div>

      <SelectField
        id="audience"
        label="Audience"
        value={audience}
        onChange={(e) => setAudience(e.target.value as AudienceValue)}
        required
      >
        {(Object.keys(AUDIENCE_LABELS) as AudienceValue[]).map((value) => (
          <option key={value} value={value}>
            {AUDIENCE_LABELS[value]}
          </option>
        ))}
      </SelectField>

      {SCOPED.includes(audience) && (
        <SelectField id="targetId" label="Specifically" defaultValue={target?.targetId ?? ""} required>
          <option value="" disabled>
            Select
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
      )}

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
        {target ? "Save changes" : "Publish notice"}
      </SubmitButton>
    </form>
  );
}

export function CreateNoticeButton({ targets }: { targets: Targets }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New notice
      </button>
      {open && (
        <Modal title="New notice" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <NoticeFields targets={targets} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditNoticeButton({ targets, target }: { targets: Targets; target: NoticeTarget }) {
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
        <Modal title="Edit notice" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <NoticeFields targets={targets} target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
