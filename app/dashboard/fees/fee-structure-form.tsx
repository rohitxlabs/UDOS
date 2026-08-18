"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { saveFeeStructure } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError } from "@/components/dashboard/form-field";
import { formatMoney } from "@/lib/format";

export type YearOption = { id: string; label: string };
export type CourseOption = { id: string; label: string };
export type SemesterOption = { id: string; label: string; courseId: string };

export type StructureTarget = {
  id: string;
  name: string;
  category: string | null;
  academicYearId: string;
  courseId: string | null;
  semesterId: string | null;
  components: { name: string; amount: string }[];
};

type ComponentDraft = { name: string; amount: string };

// Typical fee heads, offered as a starting point; the college can rename
// or add its own — nothing here is hard-coded into the billing logic.
const SUGGESTED = ["Tuition", "Examination", "Library", "Laboratory", "Development", "Sports", "Transport", "Hostel"];

function StructureFields({
  years,
  courses,
  semesters,
  target,
  onDone,
}: {
  years: YearOption[];
  courses: CourseOption[];
  semesters: SemesterOption[];
  target?: StructureTarget;
  onDone: () => void;
}) {
  const [name, setName] = useState(target?.name ?? "");
  const [category, setCategory] = useState(target?.category ?? "");
  const [academicYearId, setAcademicYearId] = useState(target?.academicYearId ?? years[0]?.id ?? "");
  const [courseId, setCourseId] = useState(target?.courseId ?? "");
  const [semesterId, setSemesterId] = useState(target?.semesterId ?? "");
  const [components, setComponents] = useState<ComponentDraft[]>(
    target?.components.length ? target.components : [{ name: "Tuition", amount: "" }]
  );
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const availableSemesters = useMemo(
    () => (courseId ? semesters.filter((s) => s.courseId === courseId) : semesters),
    [courseId, semesters]
  );

  const total = components.reduce((sum, component) => sum + (Number(component.amount) || 0), 0);

  function updateComponent(index: number, patch: Partial<ComponentDraft>) {
    setComponents((prev) => prev.map((component, i) => (i === index ? { ...component, ...patch } : component)));
  }

  function handleSubmit() {
    setError(undefined);
    startTransition(async () => {
      const result = await saveFeeStructure({
        id: target?.id,
        name,
        category,
        academicYearId,
        courseId: courseId || undefined,
        semesterId: semesterId || undefined,
        components: components
          .filter((component) => component.name.trim() !== "")
          .map((component) => ({ name: component.name, amount: Number(component.amount) || 0 })),
      });
      if (result.error) setError(result.error);
      else {
        toast.success(target ? "Fee structure updated" : "Fee structure created");
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="name"
        label="Structure name"
        placeholder="B.Tech CSE — Semester 1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="category"
          label="Category (optional)"
          placeholder="General / SC / Management"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <SelectField
          id="academicYearId"
          label="Academic year"
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
          required
        >
          <option value="" disabled>
            Select year
          </option>
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          id="courseId"
          label="Course"
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setSemesterId("");
          }}
        >
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </SelectField>
        <SelectField id="semesterId" label="Semester" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
          <option value="">All semesters</option>
          {availableSemesters.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="rounded-2xl border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Fee components</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(total)}</p>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {components.map((component, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                list="fee-component-names"
                value={component.name}
                onChange={(e) => updateComponent(index, { name: e.target.value })}
                placeholder="Component"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={component.amount}
                onChange={(e) => updateComponent(index, { amount: e.target.value })}
                placeholder="0.00"
                className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
              <button
                onClick={() => setComponents((prev) => prev.filter((_, i) => i !== index))}
                disabled={components.length === 1}
                title="Remove component"
                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <datalist id="fee-component-names">
            {SUGGESTED.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>

        <button
          onClick={() => setComponents((prev) => [...prev, { name: "", amount: "" }])}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add component
        </button>
      </div>

      <FormError message={error} />

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="mt-2 flex items-center justify-center gap-2 rounded-full bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Create fee structure"}
      </button>
    </div>
  );
}

export function CreateStructureButton(props: {
  years: YearOption[];
  courses: CourseOption[];
  semesters: SemesterOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New fee structure
      </button>
      {open && (
        <Modal title="New fee structure" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <StructureFields {...props} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditStructureButton(props: {
  years: YearOption[];
  courses: CourseOption[];
  semesters: SemesterOption[];
  target: StructureTarget;
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
        <Modal title="Edit fee structure" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <StructureFields {...props} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
