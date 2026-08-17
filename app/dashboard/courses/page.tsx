import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { CreateCourseButton } from "./course-form";
import { CoursesTable } from "./courses-table";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function CoursesPage() {
  await requireCapability("courses", "view");

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  if (departments.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-slate-900">Courses</h1>
        <SetupRequired
          message="Add at least one department before adding courses."
          href="/dashboard/departments"
          cta="Go to Departments"
        />
      </div>
    );
  }

  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
    include: { department: { select: { name: true } }, _count: { select: { students: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500">Programs offered under each department.</p>
        </div>
        <CreateCourseButton departments={departments} />
      </div>

      <CoursesTable
        departments={departments}
        courses={courses.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          durationSemesters: c.durationSemesters,
          departmentId: c.departmentId,
          departmentName: c.department.name,
          studentCount: c._count.students,
        }))}
      />
    </div>
  );
}
