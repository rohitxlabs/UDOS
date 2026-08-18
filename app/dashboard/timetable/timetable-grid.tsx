"use client";

import { Trash2 } from "lucide-react";
import { deleteTimetableSlot } from "./actions";
import { DAYS, EditSlotButton, type Option, type SlotTarget } from "./timetable-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type SlotRow = SlotTarget & { subjectName: string; subjectCode: string; teacherName: string };

// Only weekdays + Saturday are shown; a Sunday slot would still be stored
// and editable from the list, but colleges rarely timetable one.
const VISIBLE_DAYS = [0, 1, 2, 3, 4, 5];

export function TimetableGrid({
  sectionId,
  slots,
  subjects,
  teachers,
  canEdit,
  canDelete,
}: {
  sectionId: string;
  slots: SlotRow[];
  subjects: Option[];
  teachers: Option[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const periods = [...new Set(slots.map((s) => s.periodNumber))].sort((a, b) => a - b);
  const rows = periods.length > 0 ? periods : [1, 2, 3, 4, 5, 6];

  const byCell = new Map<string, SlotRow>();
  for (const slot of slots) byCell.set(`${slot.dayOfWeek}-${slot.periodNumber}`, slot);

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-24 px-4 py-3 font-medium">Period</th>
            {VISIBLE_DAYS.map((day) => (
              <th key={day} className="px-3 py-3 font-medium">
                {DAYS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((period) => (
            <tr key={period} className="align-top">
              <td className="px-4 py-3 font-medium text-slate-900">P{period}</td>
              {VISIBLE_DAYS.map((day) => {
                const slot = byCell.get(`${day}-${period}`);
                return (
                  <td key={day} className="px-2 py-2">
                    {slot ? (
                      <div className="group rounded-xl bg-blue-50/70 px-3 py-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium text-slate-900">{slot.subjectCode}</p>
                          <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                            {canEdit && (
                              <EditSlotButton
                                sectionId={sectionId}
                                subjects={subjects}
                                teachers={teachers}
                                target={slot}
                              />
                            )}
                            {canDelete && (
                              <ConfirmButton
                                title="Remove this period?"
                                description={`${slot.subjectName} on ${DAYS[slot.dayOfWeek]}, period ${slot.periodNumber}.`}
                                confirmLabel="Remove"
                                onConfirm={() => deleteTimetableSlot(slot.id)}
                                successMessage="Period removed"
                                trigger={
                                  <button title="Remove" className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                }
                              />
                            )}
                          </div>
                        </div>
                        <p className="truncate text-xs text-slate-600">{slot.subjectName}</p>
                        <p className="truncate text-xs text-slate-500">{slot.teacherName}</p>
                        <p className="text-xs text-slate-400">
                          {slot.startTime}–{slot.endTime}
                          {slot.room ? ` · ${slot.room}` : ""}
                        </p>
                      </div>
                    ) : (
                      <div className="h-full min-h-[54px] rounded-xl border border-dashed border-slate-200" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
