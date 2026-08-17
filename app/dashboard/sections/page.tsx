import { requireCapability } from "@/lib/auth/dal";
import { CreateSectionButton } from "./section-form";
import { SectionsTable } from "./sections-table";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function SectionsPage() {
  const ctx = await requireCapability("sections", "view");

  const semesters = await ctx.db.semester.findMany({
    orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
    include: { course: { select: { name: true } }, academicYear: { select: { name: true } } },
  });

  if (semesters.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-slate-900">Sections</h1>
        <SetupRequired
          message="Generate at least one semester before adding sections."
          href="/dashboard/semesters"
          cta="Go to Semesters"
        />
      </div>
    );
  }

  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: `${s.course.name} — ${s.academicYear.name} — Sem ${s.number}`,
  }));

  const sections = await ctx.db.section.findMany({
    orderBy: { name: "asc" },
    include: {
      semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } },
      _count: { select: { students: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Sections</h1>
          <p className="text-sm text-slate-500">Sub-groups of students within a semester.</p>
        </div>
        <CreateSectionButton semesters={semesterOptions} />
      </div>

      <SectionsTable
        semesters={semesterOptions}
        sections={sections.map((s) => ({
          id: s.id,
          name: s.name,
          semesterId: s.semesterId,
          semesterLabel: `${s.semester.course.name} — ${s.semester.academicYear.name} — Sem ${s.semester.number}`,
          studentCount: s._count.students,
        }))}
      />
    </div>
  );
}
