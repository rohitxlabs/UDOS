"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const assignmentSchema = z.object({
  id: z.string().optional(),
  sectionId: z.string().min(1, "Section is required"),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  title: z.string().trim().min(2, "Title is required"),
  description: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  attachmentUrl: z.string().trim().url("Attachment must be a valid URL").optional().or(z.literal("")),
  deadline: z.string().min(1, "Deadline is required"),
  maxMarks: z.coerce.number().int().min(1).max(1000),
});

export type AssignmentState = { error?: string; success?: boolean };

export async function saveAssignment(_prev: AssignmentState, formData: FormData): Promise<AssignmentState> {
  const ctx = await requireCapability("assignments", formData.get("id") ? "edit" : "create");

  const parsed = assignmentSchema.safeParse({
    id: formData.get("id") || undefined,
    sectionId: formData.get("sectionId"),
    subjectId: formData.get("subjectId"),
    teacherId: formData.get("teacherId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") || undefined,
    attachmentUrl: formData.get("attachmentUrl") || "",
    deadline: formData.get("deadline"),
    maxMarks: formData.get("maxMarks"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, sectionId, subjectId, teacherId, title, description, instructions, attachmentUrl, deadline, maxMarks } =
    parsed.data;

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return { error: "Invalid deadline" };

  // The subject must belong to the section's own semester, otherwise a
  // section could be handed work from a syllabus it never studies.
  const [section, subject] = await Promise.all([
    ctx.db.section.findUnique({ where: { id: sectionId } }),
    ctx.db.subject.findUnique({ where: { id: subjectId } }),
  ]);
  if (!section) return { error: "Section not found" };
  if (!subject || subject.semesterId !== section.semesterId) {
    return { error: "That subject is not taught in this section's semester" };
  }

  const data = {
    sectionId,
    subjectId,
    teacherId,
    title,
    description: description || null,
    instructions: instructions || null,
    attachmentUrl: attachmentUrl || null,
    deadline: deadlineDate,
    maxMarks,
  };

  const assignment = id
    ? await ctx.db.assignment.update({ where: { id }, data })
    : await ctx.db.assignment.create({ data });

  // Creating an assignment opens a submission slot for every active
  // student in the section, so the grading roster is complete from day one
  // instead of only listing students who happened to upload something.
  if (!id) {
    const students = await ctx.db.student.findMany({
      where: { sectionId, status: "ACTIVE" },
      select: { id: true },
    });
    if (students.length > 0) {
      await ctx.db.assignmentSubmission.createMany({
        data: students.map((student) => ({ assignmentId: assignment.id, studentId: student.id })),
        skipDuplicates: true,
      });
    }
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "ASSIGNMENT_UPDATED" : "ASSIGNMENT_CREATED",
    module: "assignments",
    recordId: assignment.id,
    newValue: { title, subjectId, sectionId, deadline, maxMarks },
  });

  revalidatePath("/dashboard/assignments");
  return { success: true };
}

export async function deleteAssignment(id: string) {
  const ctx = await requireCapability("assignments", "delete");

  try {
    await ctx.db.assignment.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "assignment"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ASSIGNMENT_DELETED",
    module: "assignments",
    recordId: id,
  });

  revalidatePath("/dashboard/assignments");
}

const gradeSchema = z.object({
  submissionId: z.string().min(1),
  marksObtained: z.coerce.number().int().min(0).max(1000).nullable(),
  feedback: z.string().trim().max(2000).optional(),
  status: z.enum(["NOT_SUBMITTED", "SUBMITTED", "LATE", "REVIEWED"]),
});

export async function gradeSubmission(input: {
  submissionId: string;
  marksObtained: number | null;
  feedback?: string;
  status: "NOT_SUBMITTED" | "SUBMITTED" | "LATE" | "REVIEWED";
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("assignments", "edit");

  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { submissionId, marksObtained, feedback, status } = parsed.data;

  const submission = await ctx.db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { id: true, maxMarks: true } } },
  });
  if (!submission) return { error: "Submission not found" };
  if (marksObtained !== null && marksObtained > submission.assignment.maxMarks) {
    return { error: `Marks cannot exceed ${submission.assignment.maxMarks}` };
  }

  await ctx.db.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      marksObtained,
      feedback: feedback || null,
      status,
      reviewedAt: status === "REVIEWED" ? new Date() : null,
    },
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ASSIGNMENT_SUBMISSION_GRADED",
    module: "assignments",
    recordId: submissionId,
    newValue: { marksObtained, status },
  });

  revalidatePath(`/dashboard/assignments/${submission.assignment.id}`);
  return { success: true };
}
