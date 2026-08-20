"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";

const componentSchema = z.coerce.number().int().min(0).max(1000).nullable();

const entrySchema = z.object({
  studentId: z.string().min(1),
  internal: componentSchema,
  assignmentMarks: componentSchema,
  practical: componentSchema,
  viva: componentSchema,
  theory: componentSchema,
});

const saveSchema = z.object({
  examSubjectId: z.string().min(1, "Select a paper"),
  entries: z.array(entrySchema).min(1, "Nothing to save"),
});

export type MarksEntryInput = z.infer<typeof entrySchema>;

function sumComponents(entry: MarksEntryInput): number | null {
  const parts = [entry.internal, entry.assignmentMarks, entry.practical, entry.viva, entry.theory];
  // A paper with nothing entered at all stays null (i.e. "not marked yet")
  // rather than silently becoming a zero the student then fails on.
  if (parts.every((p) => p === null)) return null;
  return parts.reduce<number>((sum, part) => sum + (part ?? 0), 0);
}

// Saving always writes DRAFT rows. Moving a paper to SUBMITTED/VERIFIED is
// a separate, permission-gated step — marks should not become official just
// because someone typed a number.
export async function saveMarks(input: {
  examSubjectId: string;
  entries: MarksEntryInput[];
}): Promise<{ error?: string; saved?: number }> {
  const ctx = await requireCapability("marks", "create");

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { examSubjectId, entries } = parsed.data;

  const examSubject = await ctx.db.examSubject.findUnique({
    where: { id: examSubjectId },
    include: { exam: { select: { id: true, semesterId: true } } },
  });
  if (!examSubject) return { error: "Paper not found" };

  const locked = await ctx.db.marks.findFirst({
    where: { examSubjectId, status: "VERIFIED" },
    select: { id: true },
  });
  if (locked) return { error: "Marks for this paper are verified and can no longer be edited" };

  const validStudents = await ctx.db.student.findMany({
    where: { id: { in: entries.map((e) => e.studentId) }, semesterId: examSubject.exam.semesterId },
    select: { id: true },
  });
  const allowed = new Set(validStudents.map((s) => s.id));
  const accepted = entries.filter((e) => allowed.has(e.studentId));
  if (accepted.length === 0) return { error: "No valid students for this paper" };

  const over = accepted.find((entry) => {
    const total = sumComponents(entry);
    return total !== null && total > examSubject.maxMarks;
  });
  if (over) return { error: `Total marks cannot exceed ${examSubject.maxMarks}` };

  await ctx.db.$transaction(
    accepted.map((entry) => {
      const total = sumComponents(entry);
      const data = {
        internal: entry.internal,
        assignmentMarks: entry.assignmentMarks,
        practical: entry.practical,
        viva: entry.viva,
        theory: entry.theory,
        total,
        enteredById: ctx.userId,
      };
      return ctx.db.marks.upsert({
        where: { examSubjectId_studentId: { examSubjectId, studentId: entry.studentId } },
        create: { examSubjectId, studentId: entry.studentId, status: "DRAFT", ...data },
        update: { status: "DRAFT", ...data },
      });
    })
  );

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "MARKS_SAVED",
    module: "marks",
    recordId: examSubjectId,
    newValue: { examSubjectId, count: accepted.length },
  });

  revalidatePath("/dashboard/marks");
  return { saved: accepted.length };
}

// Hands the paper on to whoever verifies it. Requires a complete sheet —
// a half-entered paper submitted for verification is how students end up
// with a missing subject on a published result.
export async function submitMarks(examSubjectId: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("marks", "edit");

  const marks = await ctx.db.marks.findMany({ where: { examSubjectId } });
  if (marks.length === 0) return { error: "Enter marks before submitting" };
  const missing = marks.filter((m) => m.total === null).length;
  if (missing > 0) return { error: `${missing} student(s) still have no marks entered` };
  if (marks.some((m) => m.status === "VERIFIED")) return { error: "This paper is already verified" };

  await ctx.db.marks.updateMany({ where: { examSubjectId }, data: { status: "SUBMITTED" } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "MARKS_SUBMITTED",
    module: "marks",
    recordId: examSubjectId,
    newValue: { count: marks.length },
  });

  revalidatePath("/dashboard/marks");
  return { success: true };
}

// Verification is the point of no return — after this the sheet is locked
// and results can be generated from it.
export async function verifyMarks(examSubjectId: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("marks", "approve");

  const marks = await ctx.db.marks.findMany({ where: { examSubjectId }, select: { id: true, status: true } });
  if (marks.length === 0) return { error: "Nothing to verify" };
  if (marks.some((m) => m.status === "DRAFT")) return { error: "Submit the marks sheet before verifying it" };

  await ctx.db.marks.updateMany({
    where: { examSubjectId },
    data: { status: "VERIFIED", verifiedById: ctx.userId, verifiedAt: new Date() },
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "MARKS_VERIFIED",
    module: "marks",
    recordId: examSubjectId,
    newValue: { count: marks.length },
  });

  revalidatePath("/dashboard/marks");
  return { success: true };
}

// Sends a submitted sheet back for correction. Verified sheets stay locked.
export async function reopenMarks(examSubjectId: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("marks", "approve");

  const marks = await ctx.db.marks.findMany({ where: { examSubjectId }, select: { status: true } });
  if (marks.length === 0) return { error: "Nothing to reopen" };
  if (marks.some((m) => m.status === "VERIFIED")) {
    return { error: "Verified marks cannot be reopened" };
  }

  await ctx.db.marks.updateMany({ where: { examSubjectId }, data: { status: "DRAFT" } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "MARKS_REOPENED",
    module: "marks",
    recordId: examSubjectId,
  });

  revalidatePath("/dashboard/marks");
  return { success: true };
}
