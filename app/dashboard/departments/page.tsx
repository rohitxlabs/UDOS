import { requireCapability } from "@/lib/auth/dal";
import { CreateDepartmentButton } from "./department-form";
import { DepartmentsTable } from "./departments-table";

export default async function DepartmentsPage() {
  const ctx = await requireCapability("departments", "view");

  const departments = await ctx.db.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true, students: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500">Departments under {ctx.college.name}.</p>
        </div>
        <CreateDepartmentButton />
      </div>

      <DepartmentsTable
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          courseCount: d._count.courses,
          studentCount: d._count.students,
        }))}
      />
    </div>
  );
}
