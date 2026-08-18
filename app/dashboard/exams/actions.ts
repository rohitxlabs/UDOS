"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const examSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Name is required"),
    type: z.string().trim().min(2, "Type is required"),
    semesterId: z.string().min(1, "Semester is required"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "End date cannot be before start date", path: ["endDate"] });

export type ExamState = { error?: string; success?: boolean };

export async function saveExam(_prev: ExamState, formData: FormData): Promise<ExamState> {
  const ctx = await requireCapability("exams", formData.get("id") ? "edit" : "create");

  const parsed = examSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    type: formData.get("type"),
    semesterId: formData.get("semesterId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, name, type, semesterId, startDate, endDate } = parsed.data;

  const semester = await ctx.db.semester.findUnique({ where: { id: semesterId } });
  if (!semester) return { error: "Semester not found" };

  const data = {
    name,
    type,
    semesterId,
    // The academic year follows the semester rather than being chosen
    // separately, so an exam can never be filed under the wrong year.
    academicYearId: semester.academicYearId,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
  };

  const exam = id ? await ctx.db.examination.update({ where: { id }, data }) : await ctx.db.examination.create({ data });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "EXAM_UPDATED" : "EXAM_CREATED",
    module: "exams",
    recordId: exam.id,
    newValue: { name, type, semesterId, startDate, endDate },
  });

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function deleteExam(id: string) {
  const ctx = await requireCapability("exams", "delete");

  try {
    await ctx.db.examination.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "examination"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "EXAM_DELETED",
    module: "exams",
    recordId: id,
  });

  revalidatePath("/dashboard/exams");
}

// ── Exam schedule (one row per subject sat in the exam) ──────────────────

const examSubjectSchema = z
  .object({
    id: z.string().optional(),
    examId: z.string().min(1),
    subjectId: z.string().min(1, "Subject is required"),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Exam date is required"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    durationMin: z.coerce.number().int().min(1).max(600).optional(),
    room: z.string().trim().optional(),
    maxMarks: z.coerce.number().int().min(1).max(1000),
    passMarks: z.coerce.number().int().min(0).max(1000),
  })
  .refine((d) => d.passMarks <= d.maxMarks, {
    message: "Passing marks cannot exceed maximum marks",
    path: ["passMarks"],
  });

export async function saveExamSubject(_prev: ExamState, formData: FormData): Promise<ExamState> {
  const ctx = await requireCapability("exams", formData.get("id") ? "edit" : "create");

  const parsed = examSubjectSchema.safeParse({
    id: formData.get("id") || undefined,
    examId: formData.get("examId"),
    subjectId: formData.get("subjectId"),
    examDate: formData.get("examDate"),
    startTime: formData.get("startTime") || "",
    durationMin: formData.get("durationMin") || undefined,
    room: formData.get("room") || undefined,
    maxMarks: formData.get("maxMarks"),
    passMarks: formData.get("passMarks"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, examId, subjectId, examDate, startTime, durationMin, room, maxMarks, passMarks } = parsed.data;

  const [exam, subject] = await Promise.all([
    ctx.db.examination.findUnique({ where: { id: examId } }),
    ctx.db.subject.findUnique({ where: { id: subjectId } }),
  ]);
  if (!exam) return { error: "Examination not found" };
  if (!subject || subject.semesterId !== exam.semesterId) {
    return { error: "That subject does not belong to this examination's semester" };
  }

  const data = {
    examId,
    subjectId,
    examDate: new Date(`${examDate}T00:00:00.000Z`),
    startTime: startTime || null,
    durationMin: durationMin ?? null,
    room: room || null,
    maxMarks,
    passMarks,
  };

  try {
    const row = id
      ? await ctx.db.examSubject.update({ where: { id }, data })
      : await ctx.db.examSubject.create({ data });

    await writeTenantAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: id ? "EXAM_SUBJECT_UPDATED" : "EXAM_SUBJECT_SCHEDULED",
      module: "exams",
      recordId: row.id,
      newValue: { examId, subjectId, examDate, maxMarks, passMarks },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: "That subject is already scheduled in this examination" };
    }
    throw err;
  }

  revalidatePath(`/dashboard/exams/${examId}`);
  return { success: true };
}

export async function deleteExamSubject(id: string) {
  const ctx = await requireCapability("exams", "delete");

  const row = await ctx.db.examSubject.findUnique({ where: { id }, select: { examId: true } });
  if (!row) return;

  try {
    await ctx.db.examSubject.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "scheduled subject"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "EXAM_SUBJECT_REMOVED",
    module: "exams",
    recordId: id,
  });

  revalidatePath(`/dashboard/exams/${row.examId}`);
}

// ── Eligibility ─────────────────────────────────────────────────────────

// Recomputes who may sit the exam from the college's own attendance rule.
// Deliberately a separate, explicit action rather than something implied by
// opening the page: eligibility is a decision with consequences, and the
// audit log should show when it was taken and by whom.
export async function recomputeEligibility(examId: string): Promise<{ error?: string; eligible?: number; blocked?: number }> {
  const ctx = await requireCapability("exams", "approve");

  const exam = await ctx.db.examination.findUnique({
    where: { id: examId },
    include: { examSubjects: { select: { subjectId: true } } },
  });
  if (!exam) return { error: "Examination not found" };
  if (exam.examSubjects.length === 0) return { error: "Schedule at least one subject before checking eligibility" };

  const settings = await ctx.db.settings.findUnique({ where: { id: "settings" } });
  const minPercent = Number(settings?.attendanceMinPercent ?? 75);

  const students = await ctx.db.student.findMany({
    where: { semesterId: exam.semesterId, status: "ACTIVE" },
    select: { id: true },
  });
  if (students.length === 0) return { error: "No active students in this examination's semester" };

  const subjectIds = exam.examSubjects.map((s) => s.subjectId);
  const attendance = await ctx.db.attendance.groupBy({
    by: ["studentId", "status"],
    where: { studentId: { in: students.map((s) => s.id) }, subjectId: { in: subjectIds } },
    _count: { _all: true },
  });

  const tally = new Map<string, { present: number; total: number }>();
  for (const row of attendance) {
    const entry = tally.get(row.studentId) ?? { present: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "PRESENT" || row.status === "LATE") entry.present += row._count._all;
    tally.set(row.studentId, entry);
  }

  let eligible = 0;
  let blocked = 0;

  await ctx.db.$transaction(
    students.map((student) => {
      const entry = tally.get(student.id);
      // No attendance recorded at all is treated as eligible rather than
      // blocked — a college that does not track attendance should not have
      // its entire cohort barred from the exam hall.
      const percent = !entry || entry.total === 0 ? null : (entry.present / entry.total) * 100;
      const ok = percent === null || percent >= minPercent;
      if (ok) eligible++;
      else blocked++;

      return ctx.db.examEligibility.upsert({
        where: { examId_studentId: { examId, studentId: student.id } },
        create: {
          examId,
          studentId: student.id,
          status: ok ? "ELIGIBLE" : "NOT_ELIGIBLE",
          reason: ok ? null : `Attendance ${percent?.toFixed(1)}% is below the required ${minPercent}%`,
        },
        update: {
          status: ok ? "ELIGIBLE" : "NOT_ELIGIBLE",
          reason: ok ? null : `Attendance ${percent?.toFixed(1)}% is below the required ${minPercent}%`,
        },
      });
    })
  );

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "EXAM_ELIGIBILITY_COMPUTED",
    module: "exams",
    recordId: examId,
    newValue: { eligible, blocked, minPercent },
  });

  revalidatePath(`/dashboard/exams/${examId}`);
  return { eligible, blocked };
}

// A manual override always records who took the decision and why — a
// blocked student being let into the hall is exactly the kind of action
// the audit trail exists for.
export async function overrideEligibility(input: {
  eligibilityId: string;
  status: "ELIGIBLE" | "NOT_ELIGIBLE" | "PENDING_VERIFICATION";
  reason: string;
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("exams", "approve");

  const parsed = z
    .object({
      eligibilityId: z.string().min(1),
      status: z.enum(["ELIGIBLE", "NOT_ELIGIBLE", "PENDING_VERIFICATION"]),
      reason: z.string().trim().min(3, "A reason is required for an override"),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await ctx.db.examEligibility.findUnique({
    where: { id: parsed.data.eligibilityId },
    select: { examId: true, status: true },
  });
  if (!existing) return { error: "Eligibility record not found" };

  await ctx.db.examEligibility.update({
    where: { id: parsed.data.eligibilityId },
    data: {
      status: parsed.data.status,
      reason: parsed.data.reason,
      overriddenById: ctx.userId,
      overriddenAt: new Date(),
    },
  });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "EXAM_ELIGIBILITY_OVERRIDDEN",
    module: "exams",
    recordId: parsed.data.eligibilityId,
    oldValue: { status: existing.status },
    newValue: { status: parsed.data.status, reason: parsed.data.reason },
  });

  revalidatePath(`/dashboard/exams/${existing.examId}`);
  return { success: true };
}
