"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const generateSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
});

export type GenerateSemestersState = { error?: string; success?: string };

export async function generateSemesters(
  _prev: GenerateSemestersState,
  formData: FormData
): Promise<GenerateSemestersState> {
  const ctx = await requireCapability("semesters", "create");

  const parsed = generateSchema.safeParse({
    courseId: formData.get("courseId"),
    academicYearId: formData.get("academicYearId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { courseId, academicYearId } = parsed.data;

  const course = await ctx.db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Course not found" };

  const existing = await ctx.db.semester.findMany({
    where: { courseId, academicYearId },
    select: { number: true },
  });
  const existingNumbers = new Set(existing.map((s) => s.number));
  const toCreate = Array.from({ length: course.durationSemesters }, (_, i) => i + 1).filter(
    (n) => !existingNumbers.has(n)
  );

  if (toCreate.length === 0) {
    return { error: "All semesters for this course and academic year already exist" };
  }

  await ctx.db.semester.createMany({
    data: toCreate.map((number) => ({
      courseId,
      academicYearId,
      number,
      name: `Semester ${number}`,
    })),
  });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "SEMESTERS_GENERATED",
    module: "semesters",
    recordId: courseId,
    newValue: { academicYearId, numbers: toCreate },
  });

  revalidatePath("/dashboard/semesters");
  return { success: `Created ${toCreate.length} semester${toCreate.length > 1 ? "s" : ""}` };
}

export async function deleteSemester(id: string) {
  const ctx = await requireCapability("semesters", "delete");

  try {
    await ctx.db.semester.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "semester"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "SEMESTER_DELETED",
    module: "semesters",
    recordId: id,
  });

  revalidatePath("/dashboard/semesters");
}
