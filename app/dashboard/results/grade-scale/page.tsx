import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateGradeButton } from "./grade-form";
import { GradeTable } from "./grade-table";

export default async function GradeScalePage() {
  const ctx = await requirePageAccess("results", "view");

  const grades = await ctx.db.gradeScale.findMany({ orderBy: { minPercent: "desc" } });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/results"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Results
      </Link>

      <PageHeader
        title="Grade scale"
        description="Your college's own grading bands. Results use these to award grades and compute SGPA."
        action={can(ctx, "results", "create") ? <CreateGradeButton /> : undefined}
      />

      <GradeTable
        grades={grades.map((g) => ({
          id: g.id,
          grade: g.grade,
          minPercent: g.minPercent.toString(),
          maxPercent: g.maxPercent.toString(),
          gradePoint: g.gradePoint.toString(),
        }))}
        canEdit={can(ctx, "results", "edit")}
        canDelete={can(ctx, "results", "delete")}
      />
    </div>
  );
}
