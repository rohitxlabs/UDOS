"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { assignFacultySubject, unassignFacultySubject } from "../actions";
import { SelectField } from "@/components/dashboard/form-field";

type SemesterOption = {
  id: string;
  label: string;
  subjects: { id: string; name: string }[];
  sections: { id: string; name: string }[];
};

export type AssignmentRow = { id: string; subjectName: string; sectionName: string; semesterLabel: string };

export function AssignmentsPanel({
  teacherId,
  semesters,
  assignments,
}: {
  teacherId: string;
  semesters: SemesterOption[];
  assignments: AssignmentRow[];
}) {
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [pending, startTransition] = useTransition();

  const semester = useMemo(() => semesters.find((s) => s.id === semesterId), [semesters, semesterId]);

  function handleAssign() {
    if (!subjectId || !sectionId) {
      toast.error("Select a subject and a section");
      return;
    }
    startTransition(async () => {
      try {
        await assignFacultySubject(teacherId, subjectId, sectionId);
        toast.success("Subject assigned");
        setSemesterId("");
        setSubjectId("");
        setSectionId("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      try {
        await unassignFacultySubject(assignmentId, teacherId);
        toast.success("Assignment removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Subject assignments</h2>
      <p className="mt-1 text-sm text-slate-500">Which subjects and sections this teacher is authorized to teach.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          id="assign-semester"
          label="Semester"
          value={semesterId}
          onChange={(e) => {
            setSemesterId(e.target.value);
            setSubjectId("");
            setSectionId("");
          }}
        >
          <option value="">Select semester</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="assign-subject"
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          disabled={!semester}
        >
          <option value="">Select subject</option>
          {semester?.subjects.map((subj) => (
            <option key={subj.id} value={subj.id}>
              {subj.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="assign-section"
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          disabled={!semester}
        >
          <option value="">Select section</option>
          {semester?.sections.map((sec) => (
            <option key={sec.id} value={sec.id}>
              {sec.name}
            </option>
          ))}
        </SelectField>
      </div>

      <button
        onClick={handleAssign}
        disabled={pending || !subjectId || !sectionId}
        className="mt-3 flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Assign
      </button>

      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {assignments.length === 0 && <p className="py-4 text-sm text-slate-500">No subjects assigned yet.</p>}
        {assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{a.subjectName}</p>
              <p className="text-xs text-slate-500">
                {a.semesterLabel} — Section {a.sectionName}
              </p>
            </div>
            <button
              disabled={pending}
              onClick={() => handleRemove(a.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
