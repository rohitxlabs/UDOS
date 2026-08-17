"use client";

import { Trash2 } from "lucide-react";
import { deleteCourse } from "./actions";
import { EditCourseButton } from "./course-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";

export type CourseRow = {
  id: string;
  name: string;
  code: string;
  durationSemesters: number;
  departmentId: string;
  departmentName: string;
  studentCount: number;
};

export function CoursesTable({
  courses,
  departments,
}: {
  courses: CourseRow[];
  departments: { id: string; name: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Department</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Students</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {courses.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No courses yet.
              </td>
            </tr>
          )}
          {courses.map((course) => (
            <tr key={course.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{course.name}</td>
              <td className="px-4 py-3 text-slate-600">{course.code}</td>
              <td className="px-4 py-3 text-slate-600">{course.departmentName}</td>
              <td className="px-4 py-3 text-slate-600">{course.durationSemesters} sem</td>
              <td className="px-4 py-3 text-slate-600">{course.studentCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <EditCourseButton
                    departments={departments}
                    target={{
                      id: course.id,
                      name: course.name,
                      code: course.code,
                      durationSemesters: course.durationSemesters,
                      departmentId: course.departmentId,
                    }}
                  />
                  <ConfirmButton
                    title={`Delete ${course.name}?`}
                    description="This cannot be undone. Deletion will fail if semesters or students still reference this course."
                    onConfirm={() => deleteCourse(course.id)}
                    successMessage="Course deleted"
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
