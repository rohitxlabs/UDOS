"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { recordPayment } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError } from "@/components/dashboard/form-field";
import { formatMoney } from "@/lib/format";

export type OutstandingFee = {
  id: string;
  studentName: string;
  roll: string;
  structureName: string;
  outstanding: number;
};

const METHODS: { value: string; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "ONLINE", label: "Online" },
  { value: "CHEQUE", label: "Cheque" },
];

function PaymentFields({ fees, onDone }: { fees: OutstandingFee[]; onDone: () => void }) {
  const [studentFeeId, setStudentFeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const selected = useMemo(() => fees.find((fee) => fee.id === studentFeeId), [fees, studentFeeId]);

  function handleSubmit() {
    setError(undefined);
    startTransition(async () => {
      const result = await recordPayment({
        studentFeeId,
        amount: Number(amount) || 0,
        method: method as "CASH",
        transactionId: transactionId || undefined,
        paidAt,
      });
      if (result.error) setError(result.error);
      else {
        toast.success(`Payment recorded — receipt ${result.receiptNumber}`);
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        id="studentFeeId"
        label="Student fee"
        value={studentFeeId}
        onChange={(e) => {
          setStudentFeeId(e.target.value);
          const fee = fees.find((f) => f.id === e.target.value);
          // Default to clearing the balance — part payments are the
          // exception, so pre-filling the full amount saves typing.
          setAmount(fee ? String(fee.outstanding) : "");
        }}
        required
      >
        <option value="" disabled>
          Select a student with an outstanding balance
        </option>
        {fees.map((fee) => (
          <option key={fee.id} value={fee.id}>
            {fee.roll} — {fee.studentName} — {fee.structureName} ({fee.outstanding.toFixed(2)} due)
          </option>
        ))}
      </SelectField>

      {selected && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Outstanding</span>
            <span className="font-semibold text-slate-900">{formatMoney(selected.outstanding)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="amount"
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <SelectField id="method" label="Method" value={method} onChange={(e) => setMethod(e.target.value)} required>
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField id="paidAt" label="Payment date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
        <TextField
          id="transactionId"
          label="Reference (optional)"
          placeholder="UPI / cheque no."
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
        />
      </div>

      <FormError message={error} />

      <button
        onClick={handleSubmit}
        disabled={pending || !studentFeeId}
        className="mt-2 flex items-center justify-center gap-2 rounded-full bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Record payment &amp; issue receipt
      </button>
    </div>
  );
}

export function RecordPaymentButton({ fees }: { fees: OutstandingFee[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Record payment
      </button>
      {open && (
        <Modal title="Record payment" onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <PaymentFields fees={fees} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
