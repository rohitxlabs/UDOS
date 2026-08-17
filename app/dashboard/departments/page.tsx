import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { CreateDepartmentButton } from "./department-form";
import { DepartmentsTable } from "./departments-table";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function DepartmentsPage() {
  await requireCapability("departments", "view");

  const college = await prisma.college.findFirst({ orderBy: { createdAt: "asc" } });

  if (!college) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-slate-900">Departments</h1>
        <SetupRequired
          message="Set up your college details before adding departments."
          href="/dashboard/settings"
          cta="Go to College Settings"
        />
      </div>
    );
  }

  const departments = await prisma.department.findMany({
    where: { collegeId: college.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true, students: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500">Departments under {college.name}.</p>
        </div>
        <CreateDepartmentButton collegeId={college.id} />
      </div>

      <DepartmentsTable
        collegeId={college.id}
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
