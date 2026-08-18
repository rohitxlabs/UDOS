import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { ResultsPanel, type ResultRow, type ResultStatusValue } from "./results-panel";

export default async function ResultsPage({ searchParams }: PageProps<"/dashboard/results">) {
  const ctx = await requirePageAccess("results", "view");
  const params = await searchParams;
  const examId = typeof params.exam === "string" ? params.exam : "";

  const exams = await ctx.db.examination.findMany({
    orderBy: { startDate: "desc" },
    include: { semester: { include: { course: { select: { name: true } } } } },
  });

  if (exams.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Results" />
        <SetupRequired
          message="Results are generated from an examination's verified marks."
          href="/dashboard/exams"
          cta="Go to Examinations"
        />
      </div>
    );
  }

  const exam = exams.find((e) => e.id === examId) ?? null;

  const [results, gradeBandCount] = await Promise.all([
    exam
      ? ctx.db.result.findMany({
          where: { examId: exam.id },
          orderBy: { student: { rollNumber: "asc" } },
          include: { student: { include: { user: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
    ctx.db.gradeScale.count(),
  ]);

  const rows: ResultRow[] = results.map((result) => ({
    id: result.id,
    studentName: result.student.user.name,
    roll: result.student.rollNumber ?? result.student.admissionNumber,
    totalMarks: result.totalMarks,
    percentage: result.percentage?.toString() ?? null,
    sgpa: result.sgpa?.toString() ?? null,
    cgpa: result.cgpa?.toString() ?? null,
    status: (result.status as ResultStatusValue | null) ?? null,
    published: result.publishedAt !== null,
  }));

  const publishedCount = rows.filter((r) => r.published).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Results"
        description="Compute results from verified marks, then publish them to students."
        action={
          <Link
            href="/dashboard/results/grade-scale"
            className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Grade scale
          </Link>
        }
      />

      {gradeBandCount === 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No grade scale is configured, so results will carry marks and pass/fail but no SGPA or CGPA.{" "}
          <Link href="/dashboard/results/grade-scale" className="font-medium underline">
            Set one up
          </Link>
          .
        </div>
      )}

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "exam",
            label: "Examination",
            placeholder: "Select examination",
            options: exams.map((e) => ({
              value: e.id,
              label: `${e.name} — ${e.semester.course.name} Sem ${e.semester.number}`,
            })),
          },
        ]}
      />

      {!exam ? (
        <EmptyState message="Choose an examination to generate or review its results." />
      ) : (
        <ResultsPanel
          examId={exam.id}
          rows={rows}
          publishedCount={publishedCount}
          canGenerate={can(ctx, "results", "create")}
          canApprove={can(ctx, "results", "approve")}
        />
      )}
    </div>
  );
}
