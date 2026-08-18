import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { toDateInput } from "@/lib/format";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { CreateExamButton } from "./exam-form";
import { ExamsTable, type ExamRow } from "./exams-table";

export default async function ExamsPage({ searchParams }: PageProps<"/dashboard/exams">) {
  const ctx = await requirePageAccess("exams", "view");
  const params = await searchParams;
  const semesterFilter = typeof params.semester === "string" ? params.semester : "";

  const semesters = await ctx.db.semester.findMany({
    orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
    include: { course: { select: { name: true } }, academicYear: { select: { name: true } } },
  });

  if (semesters.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Examinations" />
        <SetupRequired
          message="Generate semesters before scheduling examinations."
          href="/dashboard/semesters"
          cta="Go to Semesters"
        />
      </div>
    );
  }

  const exams = await ctx.db.examination.findMany({
    where: semesterFilter ? { semesterId: semesterFilter } : {},
    orderBy: { startDate: "desc" },
    include: {
      semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } },
      _count: { select: { examSubjects: true } },
    },
  });

  const now = new Date();

  const rows: ExamRow[] = exams.map((exam) => ({
    id: exam.id,
    name: exam.name,
    type: exam.type,
    semesterId: exam.semesterId,
    startDate: toDateInput(exam.startDate),
    endDate: toDateInput(exam.endDate),
    semesterLabel: `${exam.semester.course.name} — ${exam.semester.academicYear.name} — Sem ${exam.semester.number}`,
    rangeLabel: `${exam.startDate.toLocaleDateString()} – ${exam.endDate.toLocaleDateString()}`,
    subjectCount: exam._count.examSubjects,
    phase: exam.endDate < now ? "Completed" : exam.startDate > now ? "Upcoming" : "In progress",
  }));

  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    label: `${s.course.name} — ${s.academicYear.name} — Sem ${s.number}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Examinations"
        description="Exam sittings, their subject schedule and who is eligible to sit them."
        action={can(ctx, "exams", "create") ? <CreateExamButton semesters={semesterOptions} /> : undefined}
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "semester",
            label: "Semester",
            placeholder: "All semesters",
            options: semesterOptions.map((s) => ({ value: s.id, label: s.label })),
          },
        ]}
      />

      <ExamsTable
        exams={rows}
        semesters={semesterOptions}
        canEdit={can(ctx, "exams", "edit")}
        canDelete={can(ctx, "exams", "delete")}
      />
    </div>
  );
}
