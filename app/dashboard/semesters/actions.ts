"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { writeAuditLog } from "@/lib/audit";
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
  const session = await requireCapability("semesters", "create");

  const parsed = generateSchema.safeParse({
    courseId: formData.get("courseId"),
    academicYearId: formData.get("academicYearId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { courseId, academicYearId } = parsed.data;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Course not found" };

  const existing = await prisma.semester.findMany({
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

  await prisma.semester.createMany({
    data: toCreate.map((number) => ({
      courseId,
      academicYearId,
      number,
      name: `Semester ${number}`,
    })),
  });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "SEMESTERS_GENERATED",
    module: "semesters",
    recordId: courseId,
    newValue: { academicYearId, numbers: toCreate },
  });

  revalidatePath("/dashboard/semesters");
  return { success: `Created ${toCreate.length} semester${toCreate.length > 1 ? "s" : ""}` };
}

export async function deleteSemester(id: string) {
  const session = await requireCapability("semesters", "delete");

  try {
    await prisma.semester.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "semester"));
  }

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "SEMESTER_DELETED",
    module: "semesters",
    recordId: id,
  });

  revalidatePath("/dashboard/semesters");
}
