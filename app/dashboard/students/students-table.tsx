import Link from "next/link";

export type StudentRow = {
  id: string;
  name: string;
  admissionNumber: string;
  rollNumber: string | null;
  courseName: string | null;
  sectionLabel: string | null;
  status: string;
  isActive: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  INACTIVE: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export function StudentsTable({ students }: { students: StudentRow[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Admission No.</th>
            <th className="px-4 py-3 font-medium">Roll No.</th>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">Section</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No students found.
              </td>
            </tr>
          )}
          {students.map((student) => (
            <tr key={student.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/dashboard/students/${student.id}`} className="hover:underline">
                  {student.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{student.admissionNumber}</td>
              <td className="px-4 py-3 text-slate-600">{student.rollNumber ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{student.courseName ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{student.sectionLabel ?? "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[student.status] ?? "bg-slate-100 text-slate-500"
                  }`}
                >
                  {student.status.charAt(0) + student.status.slice(1).toLowerCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
