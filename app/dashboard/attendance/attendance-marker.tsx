"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, CheckCheck } from "lucide-react";
import { saveAttendance, type AttendanceStatusValue } from "./actions";

export type RosterEntry = {
  studentId: string;
  name: string;
  rollNumber: string | null;
  admissionNumber: string;
  status: AttendanceStatusValue | null;
};

const STATUS_OPTIONS: { value: AttendanceStatusValue; label: string; active: string }[] = [
  { value: "PRESENT", label: "P", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "ABSENT", label: "A", active: "bg-red-600 text-white border-red-600" },
  { value: "LATE", label: "L", active: "bg-amber-500 text-white border-amber-500" },
  { value: "LEAVE", label: "Lv", active: "bg-blue-600 text-white border-blue-600" },
];

export function AttendanceMarker({
  subjectId,
  date,
  roster,
  canSave,
}: {
  subjectId: string;
  date: string;
  roster: RosterEntry[];
  canSave: boolean;
}) {
  // Unmarked students default to present — the common case is a full class
  // with a couple of exceptions, so this is the fastest path to a correct
  // register.
  const [marks, setMarks] = useState<Record<string, AttendanceStatusValue>>(() =>
    Object.fromEntries(roster.map((r) => [r.studentId, r.status ?? "PRESENT"]))
  );
  const [pending, startTransition] = useTransition();

  const counts = STATUS_OPTIONS.map((option) => ({
    ...option,
    count: Object.values(marks).filter((value) => value === option.value).length,
  }));

  function markAllPresent() {
    setMarks(Object.fromEntries(roster.map((r) => [r.studentId, "PRESENT" as AttendanceStatusValue])));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveAttendance({
        subjectId,
        date,
        entries: roster.map((r) => ({ studentId: r.studentId, status: marks[r.studentId] ?? "PRESENT" })),
      });
      if (result.error) toast.error(result.error);
      else toast.success(`Attendance saved for ${result.saved} students`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => (
            <span key={c.value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {c.value.charAt(0) + c.value.slice(1).toLowerCase()}: {c.count}
            </span>
          ))}
        </div>
        {canSave && (
          <div className="flex gap-2">
            <button
              onClick={markAllPresent}
              className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <CheckCheck className="h-4 w-4" />
              All present
            </button>
            <button
              onClick={handleSave}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save attendance
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.map((entry) => (
              <tr key={entry.studentId} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-600">{entry.rollNumber ?? entry.admissionNumber}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{entry.name}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {STATUS_OPTIONS.map((option) => {
                      const selected = marks[entry.studentId] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!canSave}
                          title={option.value}
                          onClick={() => setMarks((prev) => ({ ...prev, [entry.studentId]: option.value }))}
                          className={`h-8 w-9 rounded-lg border text-xs font-semibold transition disabled:opacity-50 ${
                            selected ? option.active : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
