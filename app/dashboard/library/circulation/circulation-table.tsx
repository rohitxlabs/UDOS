"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, BookDown } from "lucide-react";
import { returnBook } from "../actions";
import { Modal } from "@/components/dashboard/modal";
import { Badge } from "@/components/dashboard/page-header";
import { TextField } from "@/components/dashboard/form-field";
import { formatMoney } from "@/lib/format";

export type LoanRow = {
  id: string;
  bookTitle: string;
  studentName: string;
  roll: string;
  issuedAtLabel: string;
  dueDateLabel: string;
  returnedAtLabel: string | null;
  overdueDays: number;
  suggestedFine: number;
  fine: number | null;
};

function ReturnDialog({ row, onClose }: { row: LoanRow; onClose: () => void }) {
  const [fine, setFine] = useState(String(row.suggestedFine));
  const [pending, startTransition] = useTransition();

  function handleReturn() {
    startTransition(async () => {
      const result = await returnBook(row.id, Number(fine) || 0);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`"${row.bookTitle}" returned`);
        onClose();
      }
    });
  }

  return (
    <Modal
      title={`Return "${row.bookTitle}"`}
      description={
        row.overdueDays > 0
          ? `${row.studentName} is ${row.overdueDays} day(s) overdue. A fine is suggested — adjust or clear it as your policy requires.`
          : `Returned by ${row.studentName}, on time.`
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <TextField
          id="fine"
          label="Fine"
          type="number"
          min={0}
          step="0.01"
          value={fine}
          onChange={(e) => setFine(e.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReturn}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm return
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CirculationTable({ loans, canReturn }: { loans: LoanRow[]; canReturn: boolean }) {
  const [returning, setReturning] = useState<LoanRow | null>(null);

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Book</th>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Issued</th>
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Fine</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loans.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                Nothing to show.
              </td>
            </tr>
          )}
          {loans.map((loan) => (
            <tr key={loan.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{loan.bookTitle}</td>
              <td className="px-4 py-3">
                <p className="text-slate-900">{loan.studentName}</p>
                <p className="text-xs text-slate-500">{loan.roll}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{loan.issuedAtLabel}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{loan.dueDateLabel}</td>
              <td className="px-4 py-3">
                {loan.returnedAtLabel ? (
                  <div>
                    <Badge tone="green">Returned</Badge>
                    <p className="mt-1 text-xs text-slate-400">{loan.returnedAtLabel}</p>
                  </div>
                ) : loan.overdueDays > 0 ? (
                  <Badge tone="red">{loan.overdueDays} day(s) overdue</Badge>
                ) : (
                  <Badge tone="blue">On loan</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{loan.fine === null ? "—" : formatMoney(loan.fine)}</td>
              <td className="px-4 py-3 text-right">
                {canReturn && !loan.returnedAtLabel && (
                  <button
                    onClick={() => setReturning(loan)}
                    title="Return"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <BookDown className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {returning && <ReturnDialog row={returning} onClose={() => setReturning(null)} />}
    </div>
  );
}
