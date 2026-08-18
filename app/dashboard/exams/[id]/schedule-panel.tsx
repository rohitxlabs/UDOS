"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { saveExamSubject, deleteExamSubject, type ExamState } from "../actions";
import { Modal } from "@/components/dashboard/modal";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type SubjectOption = { id: string; label: string; maxMarks: number; passMarks: number };
export type ScheduleTarget = {
  id: string;
  subjectId: string;
  examDate: string;
  startTime: string | null;
  durationMin: number | null;
  room: string | null;
  maxMarks: number;
  passMarks: number;
};
export type ScheduleRow = ScheduleTarget & { subjectLabel: string; examDateLabel: string };

const initialState: ExamState = {};

function ScheduleFields({
  examId,
  subjects,
  target,
  onDone,
}: {
  examId: string;
  subjects: SubjectOption[];
  target?: ScheduleTarget;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveExamSubject, initialState);
  const [subjectId, setSubjectId] = useState(target?.subjectId ?? "");
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  // Pre-fill the paper's marks from the subject's own defaults — an exam
  // may still weight it differently, but this is the usual answer.
  const picked = subjects.find((s) => s.id === subjectId);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <input type="hidden" name="examId" value={examId} />

      <SelectField
        id="subjectId"
        label="Subject"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        required
      >
        <option value="" disabled>
          Select subject
        </option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <TextField id="examDate" label="Exam date" type="date" defaultValue={target?.examDate} required />
        <TextField id="startTime" label="Start time" type="time" defaultValue={target?.startTime ?? "10:00"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="durationMin"
          label="Duration (minutes)"
          type="number"
          min={1}
          max={600}
          defaultValue={target?.durationMin ?? 180}
        />
        <TextField id="room" label="Room" placeholder="Hall 1" defaultValue={target?.room ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          key={`max-${subjectId}`}
          id="maxMarks"
          label="Maximum marks"
          type="number"
          min={1}
          max={1000}
          defaultValue={target?.maxMarks ?? picked?.maxMarks ?? 100}
          required
        />
        <TextField
          key={`pass-${subjectId}`}
          id="passMarks"
          label="Passing marks"
          type="number"
          min={0}
          max={1000}
          defaultValue={target?.passMarks ?? picked?.passMarks ?? 40}
          required
        />
      </div>

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Add to schedule"}
      </SubmitButton>
    </form>
  );
}

export function SchedulePanel({
  examId,
  subjects,
  rows,
  canCreate,
  canEdit,
  canDelete,
}: {
  examId: string;
  subjects: SubjectOption[];
  rows: ScheduleRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ScheduleTarget | null>(null);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Exam schedule</h2>
          <p className="text-xs text-slate-500">One paper per subject sat in this examination.</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add paper
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Room</th>
              <th className="px-4 py-3 font-medium">Marks (pass/max)</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No papers scheduled yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{row.subjectLabel}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.examDateLabel}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.startTime ?? "—"}
                  {row.durationMin ? ` · ${row.durationMin} min` : ""}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.room ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.passMarks} / {row.maxMarks}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <button
                        onClick={() => setEditing(row)}
                        title="Edit"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <ConfirmButton
                        title={`Remove ${row.subjectLabel}?`}
                        description="Marks recorded against this paper will be removed."
                        confirmLabel="Remove"
                        onConfirm={() => deleteExamSubject(row.id)}
                        successMessage="Paper removed"
                        trigger={
                          <button title="Remove" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        }
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Add paper" onClose={() => setCreating(false)}>
          <ScheduleFields examId={examId} subjects={subjects} onDone={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit paper" onClose={() => setEditing(null)}>
          <ScheduleFields examId={examId} subjects={subjects} target={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
