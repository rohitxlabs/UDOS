"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export type AttendanceStatusValue = (typeof STATUSES)[number];

const schema = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  entries: z
    .array(z.object({ studentId: z.string().min(1), status: z.enum(STATUSES) }))
    .min(1, "Nothing to save"),
});

export type SaveAttendanceInput = z.infer<typeof schema>;

// Attendance is stored one row per (student, subject, date) — the grid
// posts the whole roster at once, so this upserts rather than inserts:
// re-marking a day corrects it instead of failing on the unique index.
export async function saveAttendance(input: SaveAttendanceInput): Promise<{ error?: string; saved?: number }> {
  const ctx = await requireCapability("attendance", "create");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { subjectId, date, entries } = parsed.data;

  const subject = await ctx.db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return { error: "Subject not found" };

  // A day is a calendar date, not an instant — pin it to UTC midnight so
  // the same date can never land on two different rows because of the
  // server's timezone.
  const day = new Date(`${date}T00:00:00.000Z`);

  // Only students actually attached to this subject's semester may be
  // marked — a studentId from the client is never trusted on its own.
  const validStudents = await ctx.db.student.findMany({
    where: { id: { in: entries.map((e) => e.studentId) }, semesterId: subject.semesterId },
    select: { id: true },
  });
  const allowed = new Set(validStudents.map((s) => s.id));
  const accepted = entries.filter((e) => allowed.has(e.studentId));
  if (accepted.length === 0) return { error: "No valid students for this subject" };

  const teacher = await ctx.db.teacher.findUnique({ where: { userId: ctx.userId }, select: { id: true } });

  await ctx.db.$transaction(
    accepted.map((entry) =>
      ctx.db.attendance.upsert({
        where: { studentId_subjectId_date: { studentId: entry.studentId, subjectId, date: day } },
        create: { studentId: entry.studentId, subjectId, date: day, status: entry.status, markedById: teacher?.id },
        update: { status: entry.status, markedById: teacher?.id },
      })
    )
  );

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ATTENDANCE_MARKED",
    module: "attendance",
    recordId: subjectId,
    newValue: { subjectId, date, count: accepted.length },
  });

  revalidatePath("/dashboard/attendance");
  return { saved: accepted.length };
}
