import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber } from "@/lib/format";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { RecordPaymentButton, type OutstandingFee } from "./record-payment";
import { PaymentsTable, type PaymentRow, type PaymentStatusValue } from "./payments-table";

export default async function PaymentsPage({ searchParams }: PageProps<"/dashboard/payments">) {
  const ctx = await requirePageAccess("payments", "view");
  const params = await searchParams;
  const methodFilter = typeof params.method === "string" ? params.method : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";

  const feeCount = await ctx.db.studentFee.count();
  if (feeCount === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Payments" />
        <SetupRequired
          message="Bill students under a fee structure before recording payments."
          href="/dashboard/fees"
          cta="Go to Fees"
        />
      </div>
    );
  }

  const [payments, studentFees] = await Promise.all([
    ctx.db.payment.findMany({
      where: {
        ...(methodFilter ? { method: methodFilter as "CASH" } : {}),
        ...(statusFilter ? { status: statusFilter as "SUCCESS" } : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 200,
      include: {
        receipt: { select: { id: true, receiptNumber: true } },
        studentFee: {
          include: {
            feeStructure: { select: { name: true } },
            student: { include: { user: { select: { name: true } } } },
          },
        },
      },
    }),
    ctx.db.studentFee.findMany({
      orderBy: { student: { rollNumber: "asc" } },
      include: {
        feeStructure: { select: { name: true } },
        student: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const rows: PaymentRow[] = payments.map((payment) => ({
    id: payment.id,
    receiptId: payment.receipt?.id ?? null,
    receiptNumber: payment.receipt?.receiptNumber ?? null,
    studentName: payment.studentFee.student.user.name,
    roll: payment.studentFee.student.rollNumber ?? payment.studentFee.student.admissionNumber,
    structureName: payment.studentFee.feeStructure.name,
    amount: toNumber(payment.amount),
    method: payment.method,
    transactionId: payment.transactionId,
    status: payment.status as PaymentStatusValue,
    paidAtLabel: payment.paidAt?.toLocaleDateString() ?? null,
  }));

  const outstanding: OutstandingFee[] = studentFees
    .map((fee) => ({
      id: fee.id,
      studentName: fee.student.user.name,
      roll: fee.student.rollNumber ?? fee.student.admissionNumber,
      structureName: fee.feeStructure.name,
      outstanding:
        toNumber(fee.totalAmount) - toNumber(fee.discount) - toNumber(fee.scholarship) - toNumber(fee.paidAmount),
    }))
    .filter((fee) => fee.outstanding > 0);

  const collected = rows
    .filter((row) => row.status === "SUCCESS")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalOutstanding = outstanding.reduce((sum, fee) => sum + fee.outstanding, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payments"
        description="Fee collection and the receipts issued against it."
        action={
          can(ctx, "payments", "create") && outstanding.length > 0 ? (
            <RecordPaymentButton fees={outstanding} />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Collected (last 200 payments)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(collected)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totalOutstanding)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Students with dues</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{outstanding.length}</p>
        </div>
      </div>

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "method",
            label: "Method",
            placeholder: "All methods",
            options: [
              { value: "CASH", label: "Cash" },
              { value: "UPI", label: "UPI" },
              { value: "BANK_TRANSFER", label: "Bank transfer" },
              { value: "CARD", label: "Card" },
              { value: "ONLINE", label: "Online" },
              { value: "CHEQUE", label: "Cheque" },
            ],
          },
          {
            kind: "select",
            name: "status",
            label: "Status",
            placeholder: "All statuses",
            options: [
              { value: "SUCCESS", label: "Success" },
              { value: "PENDING", label: "Pending" },
              { value: "FAILED", label: "Failed" },
              { value: "REFUNDED", label: "Refunded" },
            ],
          },
        ]}
      />

      <PaymentsTable
        payments={rows}
        canPrint={can(ctx, "payments", "print")}
        canRefund={can(ctx, "payments", "approve")}
      />
    </div>
  );
}
