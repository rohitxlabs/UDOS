import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber, toDateInput } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingPanel, type StudentFeeRow } from "./billing-panel";

export default async function FeeStructureDetailPage({ params }: PageProps<"/dashboard/fees/[id]">) {
  const ctx = await requireCapability("fees", "view");
  const { id } = await params;

  const structure = await ctx.db.feeStructure.findUnique({
    where: { id },
    include: {
      components: { orderBy: { name: "asc" } },
      course: { select: { name: true } },
      semester: { select: { number: true } },
      academicYear: { select: { name: true } },
      studentFees: {
        orderBy: { student: { rollNumber: "asc" } },
        include: { student: { include: { user: { select: { name: true } } } } },
      },
    },
  });

  if (!structure) notFound();

  const total = structure.components.reduce((sum, component) => sum + toNumber(component.amount), 0);

  const rows: StudentFeeRow[] = structure.studentFees.map((fee) => ({
    id: fee.id,
    studentName: fee.student.user.name,
    roll: fee.student.rollNumber ?? fee.student.admissionNumber,
    total: toNumber(fee.totalAmount),
    discount: toNumber(fee.discount),
    scholarship: toNumber(fee.scholarship),
    paid: toNumber(fee.paidAmount),
    dueDate: fee.dueDate ? toDateInput(fee.dueDate) : null,
    dueDateLabel: fee.dueDate?.toLocaleDateString() ?? null,
  }));

  const billed = rows.reduce((sum, row) => sum + row.total - row.discount - row.scholarship, 0);
  const collected = rows.reduce((sum, row) => sum + row.paid, 0);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/fees"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All fee structures
      </Link>

      <PageHeader
        title={structure.name}
        description={`${structure.course?.name ?? "All courses"} · ${
          structure.semester ? `Semester ${structure.semester.number}` : "All semesters"
        } · ${structure.academicYear.name}${structure.category ? ` · ${structure.category}` : ""}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fee components</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {structure.components.map((component) => (
              <div key={component.id} className="flex justify-between">
                <dt className="text-slate-500">{component.name}</dt>
                <dd className="font-medium text-slate-900">{formatMoney(component.amount)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-2">
              <dt className="font-medium text-slate-700">Total per student</dt>
              <dd className="font-semibold text-slate-900">{formatMoney(total)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Net billed</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMoney(billed)}</p>
          <p className="mt-1 text-sm text-slate-500">After discounts and scholarships</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Collected</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMoney(collected)}</p>
          <p className="mt-1 text-sm text-slate-500">Outstanding {formatMoney(billed - collected)}</p>
        </div>
      </div>

      <BillingPanel
        structureId={structure.id}
        rows={rows}
        canAssign={can(ctx, "fees", "create")}
        canAdjust={can(ctx, "fees", "edit")}
      />
    </div>
  );
}
