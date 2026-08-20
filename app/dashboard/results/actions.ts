"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";
import { toNumber } from "@/lib/format";

// ── Grade scale (the college's own grading rules, spec section 12) ───────

const gradeSchema = z
  .object({
    id: z.string().optional(),
    grade: z.string().trim().min(1, "Grade is required").max(4),
    minPercent: z.coerce.number().min(0).max(100),
    maxPercent: z.coerce.number().min(0).max(100),
    gradePoint: z.coerce.number().min(0).max(10),
  })
  .refine((d) => d.maxPercent >= d.minPercent, {
    message: "Maximum percent cannot be below minimum percent",
    path: ["maxPercent"],
  });

export type GradeState = { error?: string; success?: boolean };

export async function saveGrade(_prev: GradeState, formData: FormData): Promise<GradeState> {
  const ctx = await requireCapability("results", formData.get("id") ? "edit" : "create");

  const parsed = gradeSchema.safeParse({
    id: formData.get("id") || undefined,
    grade: formData.get("grade"),
    minPercent: formData.get("minPercent"),
    maxPercent: formData.get("maxPercent"),
    gradePoint: formData.get("gradePoint"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, grade, minPercent, maxPercent, gradePoint } = parsed.data;

  // Overlapping bands would make the grade for a mark ambiguous.
  const bands = await ctx.db.gradeScale.findMany({ where: id ? { id: { not: id } } : {} });
  const overlap = bands.find((band) => minPercent <= toNumber(band.maxPercent) && maxPercent >= toNumber(band.minPercent));
  if (overlap) {
    return { error: `That range overlaps grade ${overlap.grade} (${overlap.minPercent}–${overlap.maxPercent}%)` };
  }

  const data = { grade, minPercent, maxPercent, gradePoint };
  const row = id ? await ctx.db.gradeScale.update({ where: { id }, data }) : await ctx.db.gradeScale.create({ data });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "GRADE_BAND_UPDATED" : "GRADE_BAND_CREATED",
    module: "results",
    recordId: row.id,
    newValue: data,
  });

  revalidatePath("/dashboard/results/grade-scale");
  return { success: true };
}

export async function deleteGrade(id: string) {
  const ctx = await requireCapability("results", "delete");

  try {
    await ctx.db.gradeScale.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "grade band"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "GRADE_BAND_DELETED",
    module: "results",
    recordId: id,
  });

  revalidatePath("/dashboard/results/grade-scale");
}

// ── Result generation ────────────────────────────────────────────────────

// Results are computed only from VERIFIED marks: an unverified sheet is
// still a working document, and a published result built on one cannot be
// quietly corrected afterwards.
export async function generateResults(examId: string): Promise<{ error?: string; generated?: number }> {
  const ctx = await requireCapability("results", "create");

  const exam = await ctx.db.examination.findUnique({
    where: { id: examId },
    include: {
      examSubjects: { include: { subject: { select: { credits: true, name: true } } } },
    },
  });
  if (!exam) return { error: "Examination not found" };
  if (exam.examSubjects.length === 0) return { error: "This examination has no papers scheduled" };

  const marks = await ctx.db.marks.findMany({
    where: { examSubjectId: { in: exam.examSubjects.map((p) => p.id) } },
  });
  if (marks.length === 0) return { error: "No marks have been entered for this examination" };

  const unverified = marks.filter((m) => m.status !== "VERIFIED");
  if (unverified.length > 0) {
    return { error: `${unverified.length} marks entr${unverified.length === 1 ? "y is" : "ies are"} not verified yet` };
  }

  const gradeBands = await ctx.db.gradeScale.findMany({ orderBy: { minPercent: "desc" } });

  const paperById = new Map(exam.examSubjects.map((p) => [p.id, p]));

  // Group every student's papers together so one result row covers the
  // whole sitting rather than one row per subject.
  const byStudent = new Map<string, typeof marks>();
  for (const mark of marks) {
    const list = byStudent.get(mark.studentId) ?? [];
    list.push(mark);
    byStudent.set(mark.studentId, list);
  }

  const results: { studentId: string; totalMarks: number; percentage: number; sgpa: number | null; status: "PASS" | "FAIL" | "BACKLOG" }[] = [];

  for (const [studentId, studentMarks] of byStudent) {
    let obtained = 0;
    let possible = 0;
    let weightedPoints = 0;
    let credits = 0;
    let failedPapers = 0;

    for (const mark of studentMarks) {
      const paper = paperById.get(mark.examSubjectId);
      if (!paper) continue;

      const total = mark.total ?? 0;
      obtained += total;
      possible += paper.maxMarks;
      if (total < paper.passMarks) failedPapers++;

      const paperPercent = paper.maxMarks === 0 ? 0 : (total / paper.maxMarks) * 100;
      const band = gradeBands.find(
        (b) => paperPercent >= toNumber(b.minPercent) && paperPercent <= toNumber(b.maxPercent)
      );
      const paperCredits = paper.subject.credits;
      if (band && paperCredits > 0) {
        weightedPoints += toNumber(band.gradePoint) * paperCredits;
        credits += paperCredits;
      }
    }

    const percentage = possible === 0 ? 0 : (obtained / possible) * 100;
    // SGPA needs both a grade scale and credited subjects; without either
    // the result still carries marks and a pass/fail, just no GPA.
    const sgpa = credits > 0 ? weightedPoints / credits : null;

    results.push({
      studentId,
      totalMarks: obtained,
      percentage,
      sgpa,
      // A single failed paper is a backlog, not an outright fail — the
      // student clears that subject rather than repeating the semester.
      status: failedPapers === 0 ? "PASS" : failedPapers === studentMarks.length ? "FAIL" : "BACKLOG",
    });
  }

  await ctx.db.$transaction(
    results.map((result) =>
      ctx.db.result.upsert({
        where: { studentId_examId: { studentId: result.studentId, examId } },
        create: {
          studentId: result.studentId,
          examId,
          totalMarks: result.totalMarks,
          percentage: result.percentage.toFixed(2),
          sgpa: result.sgpa === null ? null : result.sgpa.toFixed(2),
          status: result.status,
        },
        // Regenerating never silently republishes: publishedAt is left
        // exactly as it was, so a published result stays published and an
        // unpublished one stays hidden.
        update: {
          totalMarks: result.totalMarks,
          percentage: result.percentage.toFixed(2),
          sgpa: result.sgpa === null ? null : result.sgpa.toFixed(2),
          status: result.status,
        },
      })
    )
  );

  // CGPA is the running average of every SGPA the student has earned, so
  // it has to be recomputed across sittings once this one lands.
  await recomputeCgpa(
    ctx.db,
    results.map((r) => r.studentId)
  );

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "RESULTS_GENERATED",
    module: "results",
    recordId: examId,
    newValue: { count: results.length },
  });

  revalidatePath("/dashboard/results");
  return { generated: results.length };
}

type CollegeDb = Awaited<ReturnType<typeof requireCapability>>["db"];

async function recomputeCgpa(db: CollegeDb, studentIds: string[]) {
  const all = await db.result.findMany({
    where: { studentId: { in: studentIds }, sgpa: { not: null } },
    select: { id: true, studentId: true, sgpa: true },
  });

  const byStudent = new Map<string, number[]>();
  for (const row of all) {
    const list = byStudent.get(row.studentId) ?? [];
    list.push(toNumber(row.sgpa));
    byStudent.set(row.studentId, list);
  }

  const updates = all.map((row) => {
    const sgpas = byStudent.get(row.studentId) ?? [];
    const cgpa = sgpas.reduce((sum, value) => sum + value, 0) / sgpas.length;
    return db.result.update({ where: { id: row.id }, data: { cgpa: cgpa.toFixed(2) } });
  });

  if (updates.length > 0) await db.$transaction(updates);
}

export async function publishResults(examId: string): Promise<{ error?: string; published?: number }> {
  const ctx = await requireCapability("results", "approve");

  const pending = await ctx.db.result.count({ where: { examId, publishedAt: null } });
  if (pending === 0) return { error: "There are no unpublished results for this examination" };

  await ctx.db.result.updateMany({ where: { examId, publishedAt: null }, data: { publishedAt: new Date() } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "RESULTS_PUBLISHED",
    module: "results",
    recordId: examId,
    newValue: { count: pending },
  });

  revalidatePath("/dashboard/results");
  return { published: pending };
}

export async function unpublishResults(examId: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("results", "approve");

  const published = await ctx.db.result.count({ where: { examId, publishedAt: { not: null } } });
  if (published === 0) return { error: "Nothing is published for this examination" };

  await ctx.db.result.updateMany({ where: { examId }, data: { publishedAt: null } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "RESULTS_WITHDRAWN",
    module: "results",
    recordId: examId,
    oldValue: { published },
  });

  revalidatePath("/dashboard/results");
  return { success: true };
}
