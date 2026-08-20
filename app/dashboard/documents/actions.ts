"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z.object({
  studentId: z.string().min(1, "Student is required"),
  type: z.string().trim().min(2, "Document type is required"),
  fileUrl: z.string().trim().url("A valid document link is required"),
});

export type DocumentState = { error?: string; success?: boolean };

export async function saveDocument(_prev: DocumentState, formData: FormData): Promise<DocumentState> {
  const ctx = await requireCapability("documents", "create");

  const parsed = schema.safeParse({
    studentId: formData.get("studentId"),
    type: formData.get("type"),
    fileUrl: formData.get("fileUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { studentId, type, fileUrl } = parsed.data;

  const student = await ctx.db.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return { error: "Student not found" };

  // A newly attached document always starts unverified, whoever uploads it.
  const document = await ctx.db.document.create({ data: { studentId, type, fileUrl, verified: false } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "DOCUMENT_UPLOADED",
    module: "documents",
    recordId: document.id,
    newValue: { studentId, type },
  });

  revalidatePath("/dashboard/documents");
  return { success: true };
}

// Verification is a statement that a human checked the document against
// the original, so it is a separate capability from uploading one.
export async function setDocumentVerified(id: string, verified: boolean): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("documents", "approve");

  const document = await ctx.db.document.findUnique({ where: { id } });
  if (!document) return { error: "Document not found" };
  if (document.verified === verified) return { success: true };

  await ctx.db.document.update({ where: { id }, data: { verified } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: verified ? "DOCUMENT_VERIFIED" : "DOCUMENT_UNVERIFIED",
    module: "documents",
    recordId: id,
    oldValue: { verified: document.verified },
    newValue: { verified },
  });

  revalidatePath("/dashboard/documents");
  return { success: true };
}

export async function deleteDocument(id: string) {
  const ctx = await requireCapability("documents", "delete");

  try {
    await ctx.db.document.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "document"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "DOCUMENT_DELETED",
    module: "documents",
    recordId: id,
  });

  revalidatePath("/dashboard/documents");
}
