"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z
  .object({
    id: z.string().optional(),
    sectionId: z.string().min(1, "Section is required"),
    subjectId: z.string().min(1, "Subject is required"),
    teacherId: z.string().min(1, "Teacher is required"),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    periodNumber: z.coerce.number().int().min(1).max(12),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time is required"),
    room: z.string().trim().optional(),
  })
  .refine((d) => d.endTime > d.startTime, { message: "End time must be after start time", path: ["endTime"] });

export type TimetableState = { error?: string; success?: boolean };

export async function saveTimetableSlot(_prev: TimetableState, formData: FormData): Promise<TimetableState> {
  const ctx = await requireCapability("timetable", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    sectionId: formData.get("sectionId"),
    subjectId: formData.get("subjectId"),
    teacherId: formData.get("teacherId"),
    dayOfWeek: formData.get("dayOfWeek"),
    periodNumber: formData.get("periodNumber"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    room: formData.get("room") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, sectionId, subjectId, teacherId, dayOfWeek, periodNumber, startTime, endTime, room } = parsed.data;

  const section = await ctx.db.section.findUnique({
    where: { id: sectionId },
    include: { semester: { select: { academicYearId: true } } },
  });
  if (!section) return { error: "Section not found" };

  // The timetable's academic year is the section's own — never a separate
  // client-supplied value that could drift out of sync with the section.
  const academicYearId = section.semester.academicYearId;

  // A teacher cannot be in two rooms in the same period of the same day.
  const clash = await ctx.db.timetable.findFirst({
    where: { teacherId, dayOfWeek, periodNumber, academicYearId, ...(id ? { id: { not: id } } : {}) },
    include: { section: { include: { semester: { include: { course: { select: { name: true } } } } } } },
  });
  if (clash) {
    return {
      error: `That teacher already teaches ${clash.section.semester.course.name} — ${clash.section.name} in this period`,
    };
  }

  try {
    const slot = id
      ? await ctx.db.timetable.update({
          where: { id },
          data: { sectionId, subjectId, teacherId, dayOfWeek, periodNumber, startTime, endTime, room: room || null, academicYearId },
        })
      : await ctx.db.timetable.create({
          data: { sectionId, subjectId, teacherId, dayOfWeek, periodNumber, startTime, endTime, room: room || null, academicYearId },
        });

    await writeCollegeAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: id ? "TIMETABLE_SLOT_UPDATED" : "TIMETABLE_SLOT_CREATED",
      module: "timetable",
      recordId: slot.id,
      newValue: { sectionId, subjectId, teacherId, dayOfWeek, periodNumber, startTime, endTime, room },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: "This section already has a class in that period on that day" };
    }
    throw err;
  }

  revalidatePath("/dashboard/timetable");
  return { success: true };
}

export async function deleteTimetableSlot(id: string) {
  const ctx = await requireCapability("timetable", "delete");

  try {
    await ctx.db.timetable.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "timetable slot"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "TIMETABLE_SLOT_DELETED",
    module: "timetable",
    recordId: id,
  });

  revalidatePath("/dashboard/timetable");
}
