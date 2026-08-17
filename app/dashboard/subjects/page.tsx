import { requireCapability } from "@/lib/auth/dal";
import { CreateSubjectButton } from "./subject-form";
import { SubjectsTable } from "./subjects-table";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function SubjectsPage() {
  const ctx = await requireCapability("subjects", "view");

  const semesters = await ctx.db.semester.findMany({
    orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
    include: { course: { select: { name: true } }, academicYear: { select: { name: true } } },
  });

  if (semesters.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-slate-900">Subjects</h1>
        <SetupRequired
          message="Generate at least one semester before adding subjects."
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

  const subjects = await ctx.db.subject.findMany({
    orderBy: { name: "asc" },
    include: {
      semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Subjects</h1>
          <p className="text-sm text-slate-500">Subjects taught within each semester.</p>
        </div>
        <CreateSubjectButton semesters={semesterOptions} />
      </div>

      <SubjectsTable
        semesters={semesterOptions}
        subjects={subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          credits: s.credits,
          maxMarks: s.maxMarks,
          passMarks: s.passMarks,
          semesterId: s.semesterId,
          semesterLabel: `${s.semester.course.name} — ${s.semester.academicYear.name} — Sem ${s.semester.number}`,
        }))}
      />
    </div>
  );
}
