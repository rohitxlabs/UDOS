"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { writeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z
  .object({
    id: z.string().optional(),
    semesterId: z.string().min(1, "Semester is required"),
    name: z.string().trim().min(2, "Name is required"),
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .transform((v) => v.toUpperCase()),
    credits: z.coerce.number().int().min(0).max(20),
    maxMarks: z.coerce.number().int().min(1).max(1000),
    passMarks: z.coerce.number().int().min(0).max(1000),
  })
  .refine((d) => d.passMarks <= d.maxMarks, {
    message: "Passing marks cannot exceed maximum marks",
    path: ["passMarks"],
  });

export type SubjectState = { error?: string; success?: boolean };

export async function saveSubject(_prev: SubjectState, formData: FormData): Promise<SubjectState> {
  const session = await requireCapability("subjects", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    semesterId: formData.get("semesterId"),
    name: formData.get("name"),
    code: formData.get("code"),
    credits: formData.get("credits"),
    maxMarks: formData.get("maxMarks"),
    passMarks: formData.get("passMarks"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, semesterId, name, code, credits, maxMarks, passMarks } = parsed.data;

  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  if (!semester) return { error: "Semester not found" };

  try {
    const subject = id
      ? await prisma.subject.update({
          where: { id },
          data: { name, code, credits, maxMarks, passMarks, semesterId, courseId: semester.courseId },
        })
      : await prisma.subject.create({
          data: { name, code, credits, maxMarks, passMarks, semesterId, courseId: semester.courseId },
        });

    await writeAuditLog({
      userId: session.userId,
      role: session.role,
      action: id ? "SUBJECT_UPDATED" : "SUBJECT_CREATED",
      module: "subjects",
      recordId: subject.id,
      newValue: { name, code, credits, maxMarks, passMarks, semesterId },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `Subject code "${code}" is already used in this course` };
    }
    throw err;
  }

  revalidatePath("/dashboard/subjects");
  return { success: true };
}

export async function deleteSubject(id: string) {
  const session = await requireCapability("subjects", "delete");

  try {
    await prisma.subject.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "subject"));
  }

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "SUBJECT_DELETED",
    module: "subjects",
    recordId: id,
  });

  revalidatePath("/dashboard/subjects");
}
