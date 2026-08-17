import { requireCapability } from "@/lib/auth/dal";
import { GenerateSemestersButton } from "./generate-form";
import { SemestersTable } from "./semesters-table";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function SemestersPage() {
  const ctx = await requireCapability("semesters", "view");

  const [courses, academicYears] = await Promise.all([
    ctx.db.course.findMany({ orderBy: { name: "asc" } }),
    ctx.db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  if (courses.length === 0 || academicYears.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-slate-900">Semesters</h1>
        <SetupRequired
          message="Add at least one course and one academic year before generating semesters."
          href={courses.length === 0 ? "/dashboard/courses" : "/dashboard/academic-years"}
          cta={courses.length === 0 ? "Go to Courses" : "Go to Academic Years"}
        />
      </div>
    );
  }

  const semesters = await ctx.db.semester.findMany({
    orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
    include: {
      course: { select: { name: true } },
      academicYear: { select: { name: true } },
      _count: { select: { sections: true, subjects: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Semesters</h1>
          <p className="text-sm text-slate-500">Generated per course, for each academic year.</p>
        </div>
        <GenerateSemestersButton courses={courses} academicYears={academicYears} />
      </div>

      <SemestersTable
        semesters={semesters.map((s) => ({
          id: s.id,
          number: s.number,
          name: s.name,
          courseName: s.course.name,
          academicYearName: s.academicYear.name,
          sectionCount: s._count.sections,
          subjectCount: s._count.subjects,
        }))}
      />
    </div>
  );
}
