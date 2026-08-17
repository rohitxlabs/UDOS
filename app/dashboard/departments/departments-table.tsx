"use client";

import { Trash2 } from "lucide-react";
import { deleteDepartment } from "./actions";
import { EditDepartmentButton } from "./department-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  courseCount: number;
  studentCount: number;
};

export function DepartmentsTable({ departments, collegeId }: { departments: DepartmentRow[]; collegeId: string }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Courses</th>
            <th className="px-4 py-3 font-medium">Students</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {departments.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No departments yet.
              </td>
            </tr>
          )}
          {departments.map((dept) => (
            <tr key={dept.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{dept.name}</td>
              <td className="px-4 py-3 text-slate-600">{dept.code}</td>
              <td className="px-4 py-3 text-slate-600">{dept.courseCount}</td>
              <td className="px-4 py-3 text-slate-600">{dept.studentCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <EditDepartmentButton collegeId={collegeId} target={{ id: dept.id, name: dept.name, code: dept.code }} />
                  <ConfirmButton
                    title={`Delete ${dept.name}?`}
                    description="This cannot be undone. Deletion will fail if courses or students still reference this department."
                    onConfirm={() => deleteDepartment(dept.id)}
                    successMessage="Department deleted"
                    trigger={
                      <button
                        title="Delete"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
