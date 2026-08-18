"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Printer, Undo2 } from "lucide-react";
import { refundPayment } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { Badge, type BadgeTone } from "@/components/dashboard/page-header";
import { TextAreaField } from "@/components/dashboard/form-field";
import { formatMoney } from "@/lib/format";

export type PaymentStatusValue = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export type PaymentRow = {
  id: string;
  receiptId: string | null;
  receiptNumber: string | null;
  studentName: string;
  roll: string;
  structureName: string;
  amount: number;
  method: string;
  transactionId: string | null;
  status: PaymentStatusValue;
  paidAtLabel: string | null;
};

const TONES: Record<PaymentStatusValue, BadgeTone> = {
  PENDING: "amber",
  SUCCESS: "green",
  FAILED: "red",
  REFUNDED: "violet",
};

function RefundDialog({ row, onClose }: { row: PaymentRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRefund() {
    startTransition(async () => {
      const result = await refundPayment(row.id, reason);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Payment refunded");
        onClose();
      }
    });
  }

  return (
    <Modal
      title={`Refund ${formatMoney(row.amount)}?`}
      description={`${row.studentName} · receipt ${row.receiptNumber ?? "—"}. The payment record and receipt are kept; the student's balance is restored.`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <TextAreaField
          id="reason"
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Duplicate payment received"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRefund}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Refund
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function PaymentsTable({
  payments,
  canPrint,
  canRefund,
}: {
  payments: PaymentRow[];
  canPrint: boolean;
  canRefund: boolean;
}) {
  const [refunding, setRefunding] = useState<PaymentRow | null>(null);

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[940px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Receipt</th>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Fee</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                No payments recorded yet.
              </td>
            </tr>
          )}
          {payments.map((payment) => (
            <tr key={payment.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{payment.receiptNumber ?? "—"}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{payment.studentName}</p>
                <p className="text-xs text-slate-500">{payment.roll}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{payment.structureName}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(payment.amount)}</td>
              <td className="px-4 py-3 text-slate-600">
                {payment.method.replaceAll("_", " ").toLowerCase()}
                {payment.transactionId && <p className="text-xs text-slate-400">{payment.transactionId}</p>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{payment.paidAtLabel ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={TONES[payment.status]}>{payment.status.toLowerCase()}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {canPrint && payment.receiptId && (
                    <Link
                      href={`/dashboard/payments/receipt/${payment.receiptId}`}
                      title="Print receipt"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                  )}
                  {canRefund && payment.status === "SUCCESS" && (
                    <button
                      onClick={() => setRefunding(payment)}
                      title="Refund"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {refunding && <RefundDialog row={refunding} onClose={() => setRefunding(null)} />}
    </div>
  );
}
