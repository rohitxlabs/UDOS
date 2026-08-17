import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { CreateStudentForm } from "./create-student-form";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function NewStudentPage() {
  await requireCapability("students", "create");

  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
    include: {
      semesters: {
        orderBy: { number: "asc" },
        include: { academicYear: { select: { name: true } }, sections: { orderBy: { name: "asc" } } },
      },
    },
  });

  const hasSections = courses.some((c) => c.semesters.some((s) => s.sections.length > 0));
  if (!hasSections) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-slate-900">New student</h1>
        <div className="mt-6">
          <SetupRequired
            message="Add at least one section before enrolling students."
            href="/dashboard/sections"
            cta="Go to Sections"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">New student</h1>
      <p className="mt-1 text-sm text-slate-500">Creates a profile and a login account with the Student role.</p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CreateStudentForm
          courses={courses.map((c) => ({
            id: c.id,
            name: c.name,
            semesters: c.semesters.map((s) => ({
              id: s.id,
              label: `${s.academicYear.name} — Sem ${s.number}`,
              sections: s.sections.map((sec) => ({ id: sec.id, name: sec.name })),
            })),
          }))}
        />
      </div>
    </div>
  );
}
