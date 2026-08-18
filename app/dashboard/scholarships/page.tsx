import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber } from "@/lib/format";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { CreateScholarshipButton } from "./scholarship-form";
import { ScholarshipsTable, type ScholarshipRow } from "./scholarships-table";

export default async function ScholarshipsPage({ searchParams }: PageProps<"/dashboard/scholarships">) {
  const ctx = await requireCapability("scholarships", "view");
  const params = await searchParams;
  const yearFilter = typeof params.year === "string" ? params.year : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";

  const [years, students] = await Promise.all([
    ctx.db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    ctx.db.student.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ rollNumber: "asc" }, { admissionNumber: "asc" }],
      include: { user: { select: { name: true } } },
    }),
  ]);

  if (years.length === 0 || students.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Scholarships" />
        <SetupRequired
          message="Academic years and students must exist before scholarships can be awarded."
          href={years.length === 0 ? "/dashboard/academic-years" : "/dashboard/students"}
          cta={years.length === 0 ? "Go to Academic Years" : "Go to Students"}
        />
      </div>
    );
  }

  const scholarships = await ctx.db.scholarship.findMany({
    where: {
      ...(yearFilter ? { academicYearId: yearFilter } : {}),
      ...(statusFilter === "approved" ? { approvedAt: { not: null } } : {}),
      ...(statusFilter === "pending" ? { approvedAt: null } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      student: { include: { user: { select: { name: true } } } },
      academicYear: { select: { name: true } },
    },
  });

  const rows: ScholarshipRow[] = scholarships.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    academicYearId: row.academicYearId,
    name: row.name,
    amount: row.amount.toString(),
    reason: row.reason,
    documentUrl: row.documentUrl,
    studentName: row.student.user.name,
    roll: row.student.rollNumber ?? row.student.admissionNumber,
    yearLabel: row.academicYear.name,
    amountLabel: formatMoney(row.amount),
    approved: row.approvedAt !== null,
    approvedAtLabel: row.approvedAt?.toLocaleDateString() ?? null,
  }));

  const approvedTotal = scholarships
    .filter((row) => row.approvedAt !== null)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const pendingCount = scholarships.filter((row) => row.approvedAt === null).length;

  const studentOptions = students.map((student) => ({
    id: student.id,
    label: `${student.rollNumber ?? student.admissionNumber} — ${student.user.name}`,
  }));
  const yearOptions = years.map((year) => ({ id: year.id, label: year.name }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Scholarships"
        description="Awards granted to students, and the approvals behind them."
        action={
          can(ctx, "scholarships", "create") ? (
            <CreateScholarshipButton students={studentOptions} years={yearOptions} />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Approved value</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(approvedTotal)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Awaiting approval</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total awards</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{scholarships.length}</p>
        </div>
      </div>

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "year",
            label: "Academic year",
            placeholder: "All years",
            options: yearOptions.map((y) => ({ value: y.id, label: y.label })),
          },
          {
            kind: "select",
            name: "status",
            label: "Status",
            placeholder: "All",
            options: [
              { value: "pending", label: "Pending approval" },
              { value: "approved", label: "Approved" },
            ],
          },
        ]}
      />

      <ScholarshipsTable
        scholarships={rows}
        students={studentOptions}
        years={yearOptions}
        canEdit={can(ctx, "scholarships", "edit")}
        canDelete={can(ctx, "scholarships", "delete")}
        canApprove={can(ctx, "scholarships", "approve")}
      />
    </div>
  );
}
