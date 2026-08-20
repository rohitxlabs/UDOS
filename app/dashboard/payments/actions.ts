"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { toNumber } from "@/lib/format";

const METHODS = ["CASH", "BANK_TRANSFER", "UPI", "CARD", "ONLINE", "CHEQUE"] as const;

const paymentSchema = z.object({
  studentFeeId: z.string().min(1, "Select a fee record"),
  amount: z.coerce.number().positive("Amount must be greater than zero").max(10_000_000),
  method: z.enum(METHODS),
  transactionId: z.string().trim().max(120).optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date is required"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// Recording a payment writes three things that must agree with each other:
// the payment row, the running paid total on the student's fee, and the
// receipt. They go in one transaction so a partial failure can never leave
// a student's balance disagreeing with their receipts.
export async function recordPayment(input: PaymentInput): Promise<{ error?: string; receiptNumber?: string }> {
  const ctx = await requireCapability("payments", "create");

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { studentFeeId, amount, method, transactionId, paidAt } = parsed.data;

  const fee = await ctx.db.studentFee.findUnique({ where: { id: studentFeeId } });
  if (!fee) return { error: "Fee record not found" };

  const payable = toNumber(fee.totalAmount) - toNumber(fee.discount) - toNumber(fee.scholarship);
  const outstanding = payable - toNumber(fee.paidAmount);
  if (outstanding <= 0) return { error: "This fee is already fully paid" };
  if (amount > outstanding) return { error: `Amount exceeds the outstanding balance of ${outstanding.toFixed(2)}` };

  if (transactionId) {
    const duplicate = await ctx.db.payment.findUnique({ where: { transactionId } });
    if (duplicate) return { error: `Transaction reference "${transactionId}" has already been recorded` };
  }

  const year = new Date(`${paidAt}T00:00:00.000Z`).getUTCFullYear();

  try {
    const receiptNumber = await ctx.db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          studentFeeId,
          amount: amount.toFixed(2),
          method,
          transactionId: transactionId || null,
          status: "SUCCESS",
          paidAt: new Date(`${paidAt}T00:00:00.000Z`),
          recordedById: ctx.userId,
        },
      });

      await tx.studentFee.update({
        where: { id: studentFeeId },
        data: { paidAmount: (toNumber(fee.paidAmount) + amount).toFixed(2) },
      });

      // Receipt numbers restart each calendar year and are padded so they
      // sort correctly in an accountant's spreadsheet.
      const issuedThisYear = await tx.receipt.count({ where: { receiptNumber: { startsWith: `RCP-${year}-` } } });
      const number = `RCP-${year}-${String(issuedThisYear + 1).padStart(5, "0")}`;

      await tx.receipt.create({ data: { paymentId: payment.id, receiptNumber: number } });
      return number;
    });

    await writeCollegeAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: "PAYMENT_RECORDED",
      module: "payments",
      recordId: studentFeeId,
      newValue: { amount, method, transactionId, receiptNumber },
    });

    revalidatePath("/dashboard/payments");
    return { receiptNumber };
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: "That payment appears to have already been recorded — please reload and check" };
    }
    throw err;
  }
}

// Refunds never delete the payment: the receipt was already issued, so the
// record has to stay and be marked instead.
export async function refundPayment(paymentId: string, reason: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("payments", "approve");

  const parsed = z.object({ reason: z.string().trim().min(3, "A reason is required") }).safeParse({ reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const payment = await ctx.db.payment.findUnique({
    where: { id: paymentId },
    include: { studentFee: true },
  });
  if (!payment) return { error: "Payment not found" };
  if (payment.status === "REFUNDED") return { error: "This payment has already been refunded" };

  const amount = toNumber(payment.amount);

  await ctx.db.$transaction([
    ctx.db.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } }),
    ctx.db.studentFee.update({
      where: { id: payment.studentFeeId },
      data: { paidAmount: Math.max(0, toNumber(payment.studentFee.paidAmount) - amount).toFixed(2) },
    }),
  ]);

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "PAYMENT_REFUNDED",
    module: "payments",
    recordId: paymentId,
    oldValue: { amount, status: payment.status },
    newValue: { status: "REFUNDED", reason: parsed.data.reason },
  });

  revalidatePath("/dashboard/payments");
  return { success: true };
}
