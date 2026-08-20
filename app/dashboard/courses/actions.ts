"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z.object({
  id: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .transform((v) => v.toUpperCase()),
  durationSemesters: z.coerce.number().int().min(1).max(20),
});

export type CourseState = { error?: string; success?: boolean };

export async function saveCourse(_prev: CourseState, formData: FormData): Promise<CourseState> {
  const ctx = await requireCapability("courses", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
    code: formData.get("code"),
    durationSemesters: formData.get("durationSemesters"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, departmentId, name, code, durationSemesters } = parsed.data;

  try {
    const course = id
      ? await ctx.db.course.update({ where: { id }, data: { name, code, durationSemesters, departmentId } })
      : await ctx.db.course.create({ data: { name, code, durationSemesters, departmentId } });

    await writeCollegeAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: id ? "COURSE_UPDATED" : "COURSE_CREATED",
      module: "courses",
      recordId: course.id,
      newValue: { name, code, durationSemesters, departmentId },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `Course code "${code}" is already used in this department` };
    }
    throw err;
  }

  revalidatePath("/dashboard/courses");
  return { success: true };
}

export async function deleteCourse(id: string) {
  const ctx = await requireCapability("courses", "delete");

  try {
    await ctx.db.course.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "course"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "COURSE_DELETED",
    module: "courses",
    recordId: id,
  });

  revalidatePath("/dashboard/courses");
}
