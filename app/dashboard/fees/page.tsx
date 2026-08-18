import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { CreateStructureButton } from "./fee-structure-form";
import { StructuresTable, type StructureRow } from "./structures-table";

export default async function FeesPage() {
  const ctx = await requirePageAccess("fees", "view");

  const [years, courses, semesters] = await Promise.all([
    ctx.db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    ctx.db.course.findMany({ orderBy: { name: "asc" } }),
    ctx.db.semester.findMany({
      orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
      include: { course: { select: { name: true } }, academicYear: { select: { name: true } } },
    }),
  ]);

  if (years.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Fees" />
        <SetupRequired
          message="Create an academic year before defining fee structures."
          href="/dashboard/academic-years"
          cta="Go to Academic Years"
        />
      </div>
    );
  }

  const structures = await ctx.db.feeStructure.findMany({
    orderBy: { name: "asc" },
    include: {
      components: true,
      course: { select: { name: true } },
      semester: { select: { number: true } },
      academicYear: { select: { name: true } },
      _count: { select: { studentFees: true } },
    },
  });

  const rows: StructureRow[] = structures.map((structure) => ({
    id: structure.id,
    name: structure.name,
    category: structure.category,
    academicYearId: structure.academicYearId,
    courseId: structure.courseId,
    semesterId: structure.semesterId,
    components: structure.components.map((component) => ({
      name: component.name,
      amount: component.amount.toString(),
    })),
    scopeLabel: [
      structure.course?.name ?? "All courses",
      structure.semester ? `Sem ${structure.semester.number}` : "All semesters",
    ].join(" · "),
    yearLabel: structure.academicYear.name,
    totalLabel: formatMoney(structure.components.reduce((sum, c) => sum + toNumber(c.amount), 0)),
    billedCount: structure._count.studentFees,
  }));

  const yearOptions = years.map((y) => ({ id: y.id, label: y.name }));
  const courseOptions = courses.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }));
  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    label: `${s.course.name} — ${s.academicYear.name} — Sem ${s.number}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fees"
        description="Fee structures and the students billed under them."
        action={
          can(ctx, "fees", "create") ? (
            <CreateStructureButton years={yearOptions} courses={courseOptions} semesters={semesterOptions} />
          ) : undefined
        }
      />

      <StructuresTable
        structures={rows}
        years={yearOptions}
        courses={courseOptions}
        semesters={semesterOptions}
        canEdit={can(ctx, "fees", "edit")}
        canDelete={can(ctx, "fees", "delete")}
      />
    </div>
  );
}
