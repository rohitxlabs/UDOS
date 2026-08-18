"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";
import { toNumber } from "@/lib/format";

const componentSchema = z.object({
  name: z.string().trim().min(1, "Component name is required"),
  amount: z.coerce.number().min(0).max(10_000_000),
});

const structureSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is required"),
  category: z.string().trim().optional(),
  academicYearId: z.string().min(1, "Academic year is required"),
  courseId: z.string().optional(),
  semesterId: z.string().optional(),
  components: z.array(componentSchema).min(1, "Add at least one fee component"),
});

export type FeeStructureInput = z.infer<typeof structureSchema>;

// A structure and its components are saved together: a fee head with no
// components has no total, and a total assembled from stale components is
// how students get billed the wrong amount.
export async function saveFeeStructure(input: FeeStructureInput): Promise<{ error?: string; id?: string }> {
  const ctx = await requireCapability("fees", input.id ? "edit" : "create");

  const parsed = structureSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, name, category, academicYearId, courseId, semesterId, components } = parsed.data;

  if (semesterId) {
    const semester = await ctx.db.semester.findUnique({ where: { id: semesterId } });
    if (!semester) return { error: "Semester not found" };
    if (courseId && semester.courseId !== courseId) {
      return { error: "That semester does not belong to the selected course" };
    }
  }

  const data = {
    name,
    category: category || null,
    academicYearId,
    courseId: courseId || null,
    semesterId: semesterId || null,
  };

  const structure = id
    ? await ctx.db.feeStructure.update({ where: { id }, data })
    : await ctx.db.feeStructure.create({ data });

  await ctx.db.feeComponent.deleteMany({ where: { feeStructureId: structure.id } });
  await ctx.db.feeComponent.createMany({
    data: components.map((component) => ({
      feeStructureId: structure.id,
      name: component.name,
      amount: component.amount.toFixed(2),
    })),
  });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "FEE_STRUCTURE_UPDATED" : "FEE_STRUCTURE_CREATED",
    module: "fees",
    recordId: structure.id,
    newValue: { name, category, components },
  });

  revalidatePath("/dashboard/fees");
  return { id: structure.id };
}

export async function deleteFeeStructure(id: string) {
  const ctx = await requireCapability("fees", "delete");

  try {
    await ctx.db.feeStructure.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "fee structure"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FEE_STRUCTURE_DELETED",
    module: "fees",
    recordId: id,
  });

  revalidatePath("/dashboard/fees");
}

// Bills every student the structure applies to. Students already billed
// under it are left alone, so running this again after new admissions
// picks up only the new arrivals rather than resetting anyone's ledger.
export async function assignFeeStructure(
  feeStructureId: string,
  dueDate?: string
): Promise<{ error?: string; assigned?: number; skipped?: number }> {
  const ctx = await requireCapability("fees", "create");

  const structure = await ctx.db.feeStructure.findUnique({
    where: { id: feeStructureId },
    include: { components: true },
  });
  if (!structure) return { error: "Fee structure not found" };
  if (structure.components.length === 0) return { error: "This structure has no fee components" };

  const total = structure.components.reduce((sum, component) => sum + toNumber(component.amount), 0);

  const students = await ctx.db.student.findMany({
    where: {
      status: "ACTIVE",
      ...(structure.courseId ? { courseId: structure.courseId } : {}),
      ...(structure.semesterId ? { semesterId: structure.semesterId } : {}),
      ...(structure.academicYearId ? { academicYearId: structure.academicYearId } : {}),
    },
    select: { id: true },
  });
  if (students.length === 0) return { error: "No active students match this structure's course, semester and year" };

  const existing = await ctx.db.studentFee.findMany({
    where: { feeStructureId, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true },
  });
  const alreadyBilled = new Set(existing.map((row) => row.studentId));
  const toBill = students.filter((student) => !alreadyBilled.has(student.id));

  if (toBill.length > 0) {
    await ctx.db.studentFee.createMany({
      data: toBill.map((student) => ({
        studentId: student.id,
        feeStructureId,
        totalAmount: total.toFixed(2),
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
      })),
    });
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FEE_STRUCTURE_ASSIGNED",
    module: "fees",
    recordId: feeStructureId,
    newValue: { assigned: toBill.length, total },
  });

  revalidatePath(`/dashboard/fees/${feeStructureId}`);
  return { assigned: toBill.length, skipped: alreadyBilled.size };
}

const adjustSchema = z.object({
  studentFeeId: z.string().min(1),
  discount: z.coerce.number().min(0).max(10_000_000),
  scholarship: z.coerce.number().min(0).max(10_000_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

// Concessions are an edit to what a student owes, so they are gated on
// `edit` and always audited with the before/after figures.
export async function adjustStudentFee(input: {
  studentFeeId: string;
  discount: number;
  scholarship: number;
  dueDate?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("fees", "edit");

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { studentFeeId, discount, scholarship, dueDate } = parsed.data;

  const fee = await ctx.db.studentFee.findUnique({ where: { id: studentFeeId } });
  if (!fee) return { error: "Student fee record not found" };

  const total = toNumber(fee.totalAmount);
  if (discount + scholarship > total) {
    return { error: "Discount and scholarship together cannot exceed the total fee" };
  }
  const payable = total - discount - scholarship;
  if (toNumber(fee.paidAmount) > payable) {
    return { error: "The student has already paid more than that would leave payable" };
  }

  await ctx.db.studentFee.update({
    where: { id: studentFeeId },
    data: {
      discount: discount.toFixed(2),
      scholarship: scholarship.toFixed(2),
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
    },
  });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "STUDENT_FEE_ADJUSTED",
    module: "fees",
    recordId: studentFeeId,
    oldValue: { discount: toNumber(fee.discount), scholarship: toNumber(fee.scholarship) },
    newValue: { discount, scholarship, dueDate },
  });

  revalidatePath(`/dashboard/fees/${fee.feeStructureId}`);
  return { success: true };
}
