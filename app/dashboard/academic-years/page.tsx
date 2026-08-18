import { requirePageAccess } from "@/lib/auth/dal";
import { CreateAcademicYearButton } from "./academic-year-form";
import { AcademicYearsTable } from "./academic-years-table";

export default async function AcademicYearsPage() {
  const ctx = await requirePageAccess("academicYears", "view");

  const years = await ctx.db.academicYear.findMany({ orderBy: { startDate: "desc" } });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Academic years</h1>
          <p className="text-sm text-slate-500">The current academic year is used across admissions, fees and exams.</p>
        </div>
        <CreateAcademicYearButton />
      </div>

      <AcademicYearsTable
        years={years.map((y) => ({
          id: y.id,
          name: y.name,
          startDate: y.startDate.toISOString(),
          endDate: y.endDate.toISOString(),
          isCurrent: y.isCurrent,
        }))}
      />
    </div>
  );
}
