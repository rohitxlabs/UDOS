"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  name: z.string().trim().min(2, "Scholarship name is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero").max(10_000_000),
  reason: z.string().trim().optional(),
  documentUrl: z.string().trim().url("Document must be a valid URL").optional().or(z.literal("")),
});

export type ScholarshipState = { error?: string; success?: boolean };

export async function saveScholarship(_prev: ScholarshipState, formData: FormData): Promise<ScholarshipState> {
  const ctx = await requireCapability("scholarships", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    studentId: formData.get("studentId"),
    academicYearId: formData.get("academicYearId"),
    name: formData.get("name"),
    amount: formData.get("amount"),
    reason: formData.get("reason") || undefined,
    documentUrl: formData.get("documentUrl") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, studentId, academicYearId, name, amount, reason, documentUrl } = parsed.data;

  if (id) {
    const existing = await ctx.db.scholarship.findUnique({ where: { id }, select: { approvedAt: true } });
    // An approved award has already been acted on downstream (it may have
    // been applied to the student's fee), so editing it would silently put
    // the two out of step.
    if (existing?.approvedAt) return { error: "An approved scholarship cannot be edited" };
  }

  const data = {
    studentId,
    academicYearId,
    name,
    amount: amount.toFixed(2),
    reason: reason || null,
    documentUrl: documentUrl || null,
  };

  const scholarship = id
    ? await ctx.db.scholarship.update({ where: { id }, data })
    : await ctx.db.scholarship.create({ data });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "SCHOLARSHIP_UPDATED" : "SCHOLARSHIP_CREATED",
    module: "scholarships",
    recordId: scholarship.id,
    newValue: { studentId, name, amount },
  });

  revalidatePath("/dashboard/scholarships");
  return { success: true };
}

export async function deleteScholarship(id: string) {
  const ctx = await requireCapability("scholarships", "delete");

  const existing = await ctx.db.scholarship.findUnique({ where: { id }, select: { approvedAt: true } });
  if (existing?.approvedAt) throw new Error("An approved scholarship cannot be deleted");

  try {
    await ctx.db.scholarship.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "scholarship"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "SCHOLARSHIP_DELETED",
    module: "scholarships",
    recordId: id,
  });

  revalidatePath("/dashboard/scholarships");
}

// Approving is what makes the award real, so it is a separate capability
// from creating one — the person who proposes a concession should not
// necessarily be the person who grants it.
export async function approveScholarship(id: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("scholarships", "approve");

  const scholarship = await ctx.db.scholarship.findUnique({ where: { id } });
  if (!scholarship) return { error: "Scholarship not found" };
  if (scholarship.approvedAt) return { error: "This scholarship is already approved" };

  await ctx.db.scholarship.update({
    where: { id },
    data: { approvedById: ctx.userId, approvedAt: new Date() },
  });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "SCHOLARSHIP_APPROVED",
    module: "scholarships",
    recordId: id,
    newValue: { studentId: scholarship.studentId, amount: scholarship.amount.toString() },
  });

  revalidatePath("/dashboard/scholarships");
  return { success: true };
}
