"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Percent } from "lucide-react";
import { assignFeeStructure, adjustStudentFee } from "../actions";
import { Modal } from "@/components/dashboard/modal";
import { Badge } from "@/components/dashboard/page-header";
import { TextField } from "@/components/dashboard/form-field";
import { formatMoney } from "@/lib/format";

export type StudentFeeRow = {
  id: string;
  studentName: string;
  roll: string;
  total: number;
  discount: number;
  scholarship: number;
  paid: number;
  dueDate: string | null;
  dueDateLabel: string | null;
};

function AdjustDialog({ row, onClose }: { row: StudentFeeRow; onClose: () => void }) {
  const [discount, setDiscount] = useState(String(row.discount));
  const [scholarship, setScholarship] = useState(String(row.scholarship));
  const [dueDate, setDueDate] = useState(row.dueDate ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await adjustStudentFee({
        studentFeeId: row.id,
        discount: Number(discount) || 0,
        scholarship: Number(scholarship) || 0,
        dueDate: dueDate || undefined,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Updated ${row.studentName}'s fee`);
        onClose();
      }
    });
  }

  const payable = row.total - (Number(discount) || 0) - (Number(scholarship) || 0);

  return (
    <Modal
      title={`Adjust fee — ${row.studentName}`}
      description={`Billed ${formatMoney(row.total)}, paid ${formatMoney(row.paid)}.`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="discount"
            label="Discount"
            type="number"
            min={0}
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <TextField
            id="scholarship"
            label="Scholarship"
            type="number"
            min={0}
            step="0.01"
            value={scholarship}
            onChange={(e) => setScholarship(e.target.value)}
          />
        </div>
        <TextField id="dueDate" label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Payable after concessions</span>
            <span className="font-semibold text-slate-900">{formatMoney(payable)}</span>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssignDialog({ structureId, onClose }: { structureId: string; onClose: () => void }) {
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    startTransition(async () => {
      const result = await assignFeeStructure(structureId, dueDate || undefined);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Billed ${result.assigned} students (${result.skipped} already billed)`);
        onClose();
      }
    });
  }

  return (
    <Modal
      title="Bill students"
      description="Every active student matching this structure's course, semester and academic year will be billed. Students already billed are left untouched."
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <TextField
          id="assignDueDate"
          label="Due date (optional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Bill students
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function BillingPanel({
  structureId,
  rows,
  canAssign,
  canAdjust,
}: {
  structureId: string;
  rows: StudentFeeRow[];
  canAssign: boolean;
  canAdjust: boolean;
}) {
  const [assigning, setAssigning] = useState(false);
  const [adjusting, setAdjusting] = useState<StudentFeeRow | null>(null);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Billed students</h2>
          <p className="text-xs text-slate-500">{rows.length} student fee record(s) under this structure.</p>
        </div>
        {canAssign && (
          <button
            onClick={() => setAssigning(true)}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Bill students
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Billed</th>
              <th className="px-4 py-3 font-medium">Concessions</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No students billed under this structure yet.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const balance = row.total - row.discount - row.scholarship - row.paid;
              const overdue = balance > 0 && row.dueDate !== null && new Date(row.dueDate) < new Date();
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{row.roll}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMoney(row.total)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMoney(row.discount + row.scholarship)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMoney(row.paid)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{formatMoney(balance)}</span>
                    {balance <= 0 && (
                      <span className="ml-2">
                        <Badge tone="green">Cleared</Badge>
                      </span>
                    )}
                    {overdue && (
                      <span className="ml-2">
                        <Badge tone="red">Overdue</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.dueDateLabel ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {canAdjust && (
                      <button
                        onClick={() => setAdjusting(row)}
                        title="Adjust concessions"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Percent className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assigning && <AssignDialog structureId={structureId} onClose={() => setAssigning(false)} />}
      {adjusting && <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}
