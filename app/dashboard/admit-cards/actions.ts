"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";

// Admit cards exist only for students the college has cleared to sit the
// exam — generating them is the point where eligibility becomes a physical
// permission to enter the hall.
export async function generateAdmitCards(examId: string): Promise<{ error?: string; generated?: number; skipped?: number }> {
  const ctx = await requireCapability("admitCards", "create");

  const exam = await ctx.db.examination.findUnique({
    where: { id: examId },
    include: { _count: { select: { examSubjects: true } } },
  });
  if (!exam) return { error: "Examination not found" };
  if (exam._count.examSubjects === 0) return { error: "Schedule the examination's papers first" };

  const eligibility = await ctx.db.examEligibility.findMany({ where: { examId } });
  if (eligibility.length === 0) {
    return { error: "Compute exam eligibility before generating admit cards" };
  }

  const eligible = eligibility.filter((row) => row.status === "ELIGIBLE");
  if (eligible.length === 0) return { error: "No students are currently eligible for this examination" };

  const existing = await ctx.db.admitCard.findMany({
    where: { examId },
    select: { studentId: true },
  });
  const alreadyHave = new Set(existing.map((row) => row.studentId));
  const toCreate = eligible.filter((row) => !alreadyHave.has(row.studentId));

  if (toCreate.length > 0) {
    await ctx.db.admitCard.createMany({
      data: toCreate.map((row) => ({
        examId,
        studentId: row.studentId,
        // A per-card token the hall invigilator can check a card against.
        qrCode: randomUUID(),
      })),
      skipDuplicates: true,
    });
  }

  // A student whose eligibility was revoked after a card was issued must
  // not keep a valid card — drop the unreleased ones.
  const revoked = eligibility.filter((row) => row.status !== "ELIGIBLE").map((row) => row.studentId);
  const removed = revoked.length
    ? await ctx.db.admitCard.deleteMany({ where: { examId, studentId: { in: revoked }, releasedAt: null } })
    : { count: 0 };

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ADMIT_CARDS_GENERATED",
    module: "admitCards",
    recordId: examId,
    newValue: { generated: toCreate.length, revoked: removed.count },
  });

  revalidatePath("/dashboard/admit-cards");
  return { generated: toCreate.length, skipped: eligible.length - toCreate.length };
}

export async function releaseAdmitCards(examId: string): Promise<{ error?: string; released?: number }> {
  const ctx = await requireCapability("admitCards", "approve");

  const pending = await ctx.db.admitCard.count({ where: { examId, releasedAt: null } });
  if (pending === 0) return { error: "There are no unreleased admit cards for this examination" };

  await ctx.db.admitCard.updateMany({
    where: { examId, releasedAt: null },
    data: { releasedAt: new Date(), releasedById: ctx.userId },
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ADMIT_CARDS_RELEASED",
    module: "admitCards",
    recordId: examId,
    newValue: { count: pending },
  });

  revalidatePath("/dashboard/admit-cards");
  return { released: pending };
}

export async function withdrawAdmitCards(examId: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("admitCards", "approve");

  const released = await ctx.db.admitCard.count({ where: { examId, releasedAt: { not: null } } });
  if (released === 0) return { error: "Nothing is released for this examination" };

  await ctx.db.admitCard.updateMany({ where: { examId }, data: { releasedAt: null, releasedById: null } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ADMIT_CARDS_WITHDRAWN",
    module: "admitCards",
    recordId: examId,
    oldValue: { released },
  });

  revalidatePath("/dashboard/admit-cards");
  return { success: true };
}
