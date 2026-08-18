import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/dal";
import { formatMoney, toNumber } from "@/lib/format";
import { PrintButton } from "@/components/dashboard/print-button";

export default async function ReceiptPage({ params }: PageProps<"/dashboard/payments/receipt/[id]">) {
  const ctx = await requireCapability("payments", "print");
  const { id } = await params;

  const receipt = await ctx.db.receipt.findUnique({
    where: { id },
    include: {
      payment: {
        include: {
          studentFee: {
            include: {
              feeStructure: { include: { components: true, academicYear: { select: { name: true } } } },
              student: {
                include: {
                  user: { select: { name: true } },
                  course: { select: { name: true } },
                  semester: { select: { number: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!receipt) notFound();

  const { payment } = receipt;
  const fee = payment.studentFee;
  const student = fee.student;
  const payable = toNumber(fee.totalAmount) - toNumber(fee.discount) - toNumber(fee.scholarship);
  const balance = payable - toNumber(fee.paidAmount);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/payments"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All payments
        </Link>
        <PrintButton />
      </div>

      {payment.status === "REFUNDED" && (
        <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-800 print:hidden">
          This payment was refunded. The receipt is retained for the record.
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-300 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-300 pb-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{ctx.college.name}</h1>
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Fee receipt</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-slate-900">{receipt.receiptNumber}</p>
            <p className="text-xs text-slate-500">{payment.paidAt?.toLocaleDateString() ?? "—"}</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Student", student.user.name],
            ["Admission number", student.admissionNumber],
            ["Roll number", student.rollNumber ?? "—"],
            ["Course", student.course?.name ?? "—"],
            ["Semester", student.semester ? `Semester ${student.semester.number}` : "—"],
            ["Academic year", fee.feeStructure.academicYear.name],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fee.feeStructure.name}</p>
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <tbody className="divide-y divide-slate-200">
              {fee.feeStructure.components.map((component) => (
                <tr key={component.id}>
                  <td className="py-2 text-slate-600">{component.name}</td>
                  <td className="py-2 text-right text-slate-900">{formatMoney(component.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-300 text-sm">
              <tr>
                <td className="py-2 text-slate-600">Total billed</td>
                <td className="py-2 text-right text-slate-900">{formatMoney(fee.totalAmount)}</td>
              </tr>
              {toNumber(fee.discount) > 0 && (
                <tr>
                  <td className="py-1 text-slate-600">Discount</td>
                  <td className="py-1 text-right text-slate-900">− {formatMoney(fee.discount)}</td>
                </tr>
              )}
              {toNumber(fee.scholarship) > 0 && (
                <tr>
                  <td className="py-1 text-slate-600">Scholarship</td>
                  <td className="py-1 text-right text-slate-900">− {formatMoney(fee.scholarship)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Amount received</span>
            <span className="text-xl font-bold text-slate-900">{formatMoney(payment.amount)}</span>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              Paid via {payment.method.replaceAll("_", " ").toLowerCase()}
              {payment.transactionId ? ` · ref ${payment.transactionId}` : ""}
            </span>
            <span>Balance after this payment: {formatMoney(balance)}</span>
          </div>
        </div>

        <div className="mt-10 flex items-end justify-between">
          <p className="text-xs text-slate-400">This is a computer-generated receipt.</p>
          <div className="text-center">
            <div className="h-10 w-36 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-500">Authorised signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
