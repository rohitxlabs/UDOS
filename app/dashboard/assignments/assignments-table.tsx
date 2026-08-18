"use client";

import Link from "next/link";
import { Trash2, ArrowUpRight } from "lucide-react";
import { deleteAssignment } from "./actions";
import {
  EditAssignmentButton,
  type AssignmentTarget,
  type SectionOption,
  type SubjectOption,
  type TeacherOption,
} from "./assignment-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Badge } from "@/components/dashboard/page-header";

export type AssignmentRow = AssignmentTarget & {
  subjectLabel: string;
  sectionLabel: string;
  teacherName: string;
  deadlineLabel: string;
  isOverdue: boolean;
  submitted: number;
  reviewed: number;
  total: number;
};

export function AssignmentsTable({
  assignments,
  sections,
  subjects,
  teachers,
  canEdit,
  canDelete,
}: {
  assignments: AssignmentRow[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Section</th>
            <th className="px-4 py-3 font-medium">Deadline</th>
            <th className="px-4 py-3 font-medium">Progress</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assignments.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No assignments yet.
              </td>
            </tr>
          )}
          {assignments.map((assignment) => (
            <tr key={assignment.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/dashboard/assignments/${assignment.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                  {assignment.title}
                </Link>
                <p className="text-xs text-slate-500">{assignment.teacherName}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{assignment.subjectLabel}</td>
              <td className="px-4 py-3 text-slate-600">{assignment.sectionLabel}</td>
              <td className="px-4 py-3">
                <span className="text-slate-600">{assignment.deadlineLabel}</span>
                {assignment.isOverdue && (
                  <span className="ml-2">
                    <Badge tone="amber">Closed</Badge>
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {assignment.reviewed} reviewed / {assignment.submitted} submitted / {assignment.total}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Link
                    href={`/dashboard/assignments/${assignment.id}`}
                    title="Open submissions"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {canEdit && (
                    <EditAssignmentButton
                      sections={sections}
                      subjects={subjects}
                      teachers={teachers}
                      target={assignment}
                    />
                  )}
                  {canDelete && (
                    <ConfirmButton
                      title={`Delete "${assignment.title}"?`}
                      description="All submissions and grades recorded against this assignment will be removed."
                      onConfirm={() => deleteAssignment(assignment.id)}
                      successMessage="Assignment deleted"
                      trigger={
                        <button title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
  );
}
