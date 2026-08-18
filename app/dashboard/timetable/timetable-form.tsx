"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveTimetableSlot, type TimetableState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type Option = { id: string; label: string };
export type SlotTarget = {
  id: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  room: string | null;
};

const initialState: TimetableState = {};

function SlotFields({
  sectionId,
  subjects,
  teachers,
  target,
  defaults,
  onDone,
}: {
  sectionId: string;
  subjects: Option[];
  teachers: Option[];
  target?: SlotTarget;
  defaults?: { dayOfWeek: number; periodNumber: number };
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveTimetableSlot, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <input type="hidden" name="sectionId" value={sectionId} />

      <SelectField id="subjectId" label="Subject" defaultValue={target?.subjectId ?? ""} required>
        <option value="" disabled>
          Select subject
        </option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>

      <SelectField id="teacherId" label="Teacher" defaultValue={target?.teacherId ?? ""} required>
        <option value="" disabled>
          Select teacher
        </option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <SelectField id="dayOfWeek" label="Day" defaultValue={target?.dayOfWeek ?? defaults?.dayOfWeek ?? 0} required>
          {DAYS.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </SelectField>
        <TextField
          id="periodNumber"
          label="Period"
          type="number"
          min={1}
          max={12}
          defaultValue={target?.periodNumber ?? defaults?.periodNumber ?? 1}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField id="startTime" label="Start time" type="time" defaultValue={target?.startTime ?? "09:00"} required />
        <TextField id="endTime" label="End time" type="time" defaultValue={target?.endTime ?? "10:00"} required />
      </div>

      <TextField id="room" label="Room (optional)" placeholder="A-204" defaultValue={target?.room ?? ""} />

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Add to timetable"}
      </SubmitButton>
    </form>
  );
}

export function CreateSlotButton({
  sectionId,
  subjects,
  teachers,
}: {
  sectionId: string;
  subjects: Option[];
  teachers: Option[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Add period
      </button>
      {open && (
        <Modal title="Add period" onClose={() => setOpen(false)}>
          <SlotFields sectionId={sectionId} subjects={subjects} teachers={teachers} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditSlotButton({
  sectionId,
  subjects,
  teachers,
  target,
}: {
  sectionId: string;
  subjects: Option[];
  teachers: Option[];
  target: SlotTarget;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit"
        className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {open && (
        <Modal title="Edit period" onClose={() => setOpen(false)}>
          <SlotFields
            sectionId={sectionId}
            subjects={subjects}
            teachers={teachers}
            target={target}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
