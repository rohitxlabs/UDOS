"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(4, "e.g. 2026-27"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type AcademicYearState = { error?: string; success?: boolean };

export async function saveAcademicYear(_prev: AcademicYearState, formData: FormData): Promise<AcademicYearState> {
  const ctx = await requireCapability("academicYears", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, name, startDate, endDate } = parsed.data;
  const data = { name, startDate: new Date(startDate), endDate: new Date(endDate) };

  try {
    const year = id
      ? await ctx.db.academicYear.update({ where: { id }, data })
      : await ctx.db.academicYear.create({ data });

    await writeCollegeAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: id ? "ACADEMIC_YEAR_UPDATED" : "ACADEMIC_YEAR_CREATED",
      module: "academicYears",
      recordId: year.id,
      newValue: data,
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `Academic year "${name}" already exists` };
    }
    throw err;
  }

  revalidatePath("/dashboard/academic-years");
  return { success: true };
}

export async function setCurrentAcademicYear(id: string) {
  const ctx = await requireCapability("academicYears", "edit");

  await ctx.db.$transaction([
    ctx.db.academicYear.updateMany({ data: { isCurrent: false }, where: { isCurrent: true } }),
    ctx.db.academicYear.update({ where: { id }, data: { isCurrent: true } }),
  ]);

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ACADEMIC_YEAR_SET_CURRENT",
    module: "academicYears",
    recordId: id,
  });

  revalidatePath("/dashboard/academic-years");
}

export async function deleteAcademicYear(id: string) {
  const ctx = await requireCapability("academicYears", "delete");

  try {
    await ctx.db.academicYear.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "academic year"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ACADEMIC_YEAR_DELETED",
    module: "academicYears",
    recordId: id,
  });

  revalidatePath("/dashboard/academic-years");
}
